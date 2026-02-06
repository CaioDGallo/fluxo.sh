import { getCurrentUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { handleDbError } from '@/lib/db-errors';
import { t } from '@/lib/i18n/server-errors';
import { classifyPluggyTransaction, extractPluggyInstallmentInfo } from '@/lib/pluggy/mapping';
import { getPluggyClient } from '@/lib/pluggy/sdk';
import type { Account, Item, Transaction } from 'pluggy-sdk';
import { ensurePluggyAccountMapping } from '@/lib/pluggy/accounts';
import { computeEntryDates, type AccountInfo } from '@/lib/import-helpers';
import { batchEnsureFaturasExist, batchUpdateFaturaTotals, syncPluggyBills } from '@/lib/actions/faturas';
import { syncAccountBalance } from '@/lib/actions/accounts';
import { getFaturaMonth } from '@/lib/fatura-utils';
import { assertOpenFinanceAccess } from '@/lib/pluggy/guards';
import { checkPluggyAutoSyncRateLimit } from '@/lib/rate-limit';
import { accounts, categories, entries, faturas, income, pluggyAccounts, pluggyItems, pluggySyncCursors, transactions } from '@/lib/schema';
import { and, asc, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getPostHogClient } from '@/lib/posthog-server';

type PluggySyncResult =
  | {
    success: true;
    pluggyItemId: string;
    syncedAt: Date;
    accountsSynced: number;
    accountsCreated: number;
    transactionsCreated: number;
    incomeCreated: number;
    skipped: number;
  }
  | {
    success: false;
    pluggyItemId: string;
    syncedAt: Date;
    error: string;
  };

type PluggySyncSource = 'manual' | 'webhook' | 'cron';

const CURSOR_SCOPE_PREFIX = 'transactions:';
const CURSOR_BUFFER_MS = 24 * 60 * 60 * 1000;
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FIRST_SYNC_RETRY_MS = 5 * 60 * 1000; // 5 minutes - short retry when first sync has no data
const ERROR_BACKOFF_BASE_MS = 30 * 60 * 1000;
const ERROR_BACKOFF_MAX_MS = 48 * 60 * 60 * 1000;

function resolveNextSyncAt(now: Date): Date {
  return new Date(now.getTime() + SYNC_INTERVAL_MS);
}

function resolveErrorBackoffAt(now: Date, errorCount: number): Date {
  const attempts = Math.max(errorCount, 1);
  const delay = Math.min(ERROR_BACKOFF_BASE_MS * Math.pow(2, attempts - 1), ERROR_BACKOFF_MAX_MS);
  return new Date(now.getTime() + delay);
}

function toDateOnly(value?: string | Date | null): string | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/**
 * Back-calculate the original purchase date from a statement date and installment number.
 * Used when Pluggy doesn't provide creditCardMetadata.purchaseDate.
 *
 * Example: If installment 8/10 has statement date March 2024,
 * the original purchase was in August 2023 (March - 7 months).
 */
function calculateBasePurchaseDateFromInstallment(
  statementDate: string,
  installmentNumber: number
): string {
  const date = new Date(statementDate + 'T00:00:00Z');
  date.setUTCMonth(date.getUTCMonth() - (installmentNumber - 1));
  return date.toISOString().split('T')[0];
}

function parseIsoDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function resolveTransactionAmount(transaction: Transaction): number | null {
  const value = transaction.amountInAccountCurrency ?? transaction.amount;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function amountToCents(amount: number): number {
  return Math.round(Math.abs(amount) * 100);
}

function balanceToCents(value: number): number {
  return Math.round(value * 100);
}

function toCentsMaybe(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return balanceToCents(value);
}

function toPositiveCentsMaybe(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(Math.abs(value) * 100);
}

function extractCreditLimitValue(account: Account): number | null {
  const creditData = account.creditData;
  if (!creditData) return null;
  const value = creditData.creditLimit ?? creditData.availableCreditLimit ?? null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

// Namespace external IDs so pluggy-sourced records are distinguishable from OFX/CSV imports
function namespacedExternalId(rawId: string): string {
  return rawId.startsWith('pluggy:') ? rawId : `pluggy:${rawId}`;
}

// Installment group: multiple transactions sharing the same purchase
type InstallmentGroup = {
  baseDescription: string;
  totalInstallments: number;
  entries: Array<{
    rawExternalId: string;
    externalId: string;
    installmentNumber: number;
    amount: number;
    purchaseDate: string;
  }>;
};

// Group expense transactions by installment metadata
function groupInstallmentTransactions(
  transactions: Array<{
    rawId: string;
    externalId: string;
    description: string;
    amountCents: number;
    purchaseDate: string;
    installmentInfo?: { current: number; total: number; baseDescription: string } | undefined;
    isFaturaPayment?: boolean;
    merchantName?: string;
    merchantBusinessName?: string;
    merchantCnpj?: string;
    beneficiaryName?: string;
  }>
): { grouped: Map<string, InstallmentGroup>; singles: typeof transactions } {
  const grouped = new Map<string, InstallmentGroup>();
  const singles: typeof transactions = [];

  for (const tx of transactions) {
    if (!tx.installmentInfo || tx.installmentInfo.total <= 1) {
      singles.push(tx);
      continue;
    }

    // Key: baseDescription (normalized) + total installments + amount per installment
    // Collision guard: amount prevents merging different purchases with same description
    const key = `${tx.installmentInfo.baseDescription}|${tx.installmentInfo.total}|${tx.amountCents}`;

    const existing = grouped.get(key);
    if (existing) {
      // Check for duplicate installment number (same key, same parcela = different purchase)
      const duplicateNumber = existing.entries.find(
        (e) => e.installmentNumber === tx.installmentInfo!.current
      );
      if (duplicateNumber) {
        // Collision: treat this as a single transaction
        singles.push(tx);
        continue;
      }
      existing.entries.push({
        rawExternalId: tx.rawId,
        externalId: tx.externalId,
        installmentNumber: tx.installmentInfo.current,
        amount: tx.amountCents,
        purchaseDate: tx.purchaseDate,
      });
    } else {
      grouped.set(key, {
        baseDescription: tx.installmentInfo.baseDescription || tx.description,
        totalInstallments: tx.installmentInfo.total,
        entries: [{
          rawExternalId: tx.rawId,
          externalId: tx.externalId,
          installmentNumber: tx.installmentInfo.current,
          amount: tx.amountCents,
          purchaseDate: tx.purchaseDate,
        }],
      });
    }
  }

  return { grouped, singles };
}

// Pair candidate for cross-account internal transfer detection
type PairCandidate = {
  externalId: string;
  accountId: number;
  amount: number;
  date: string;
  direction: 'debit' | 'credit';
};

// Match debit↔credit pairs by same amount (±1%), same date, different accounts
function detectInternalTransferPairs(candidates: PairCandidate[]): {
  expenseExternalIds: string[];  // debit side → mark expense as isInternalTransfer + ignored
  incomeExternalIds: string[];   // credit side → mark income as ignored
} {
  const expenseExternalIds: string[] = [];
  const incomeExternalIds: string[] = [];
  const usedIds = new Set<string>();

  const debits: PairCandidate[] = [];
  const creditsByDate = new Map<string, PairCandidate[]>();

  for (const candidate of candidates) {
    if (candidate.direction === 'credit') {
      const list = creditsByDate.get(candidate.date) ?? [];
      list.push(candidate);
      creditsByDate.set(candidate.date, list);
    } else {
      debits.push(candidate);
    }
  }

  for (const list of creditsByDate.values()) {
    list.sort((a, b) => a.amount - b.amount);
  }

  const findLowerBound = (list: PairCandidate[], target: number) => {
    let low = 0;
    let high = list.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (list[mid].amount < target) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    return low;
  };

  for (const debit of debits) {
    if (usedIds.has(debit.externalId)) continue;
    const credits = creditsByDate.get(debit.date);
    if (!credits || credits.length === 0) continue;

    const tolerance = Math.max(debit.amount * 0.01, 1);
    const minAmount = debit.amount - tolerance;
    const maxAmount = debit.amount + tolerance;
    const startIndex = findLowerBound(credits, minAmount);

    for (let i = startIndex; i < credits.length; i += 1) {
      const credit = credits[i];
      if (credit.amount > maxAmount) break;
      if (usedIds.has(credit.externalId)) continue;
      if (credit.accountId === debit.accountId) continue;

      expenseExternalIds.push(debit.externalId);
      incomeExternalIds.push(credit.externalId);
      usedIds.add(debit.externalId);
      usedIds.add(credit.externalId);
      break;
    }
  }

  return { expenseExternalIds, incomeExternalIds };
}

async function fetchExistingExternalIds(userId: string, externalIds: string[]): Promise<Set<string>> {
  const uniqueIds = Array.from(new Set(externalIds.filter((id): id is string => !!id)));
  if (uniqueIds.length === 0) {
    return new Set();
  }

  const [existingTransactions, existingIncome] = await Promise.all([
    db
      .select({ externalId: transactions.externalId })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.externalId, uniqueIds))),
    db
      .select({ externalId: income.externalId })
      .from(income)
      .where(and(eq(income.userId, userId), inArray(income.externalId, uniqueIds))),
  ]);

  return new Set([
    ...existingTransactions.map((row) => row.externalId).filter((id): id is string => !!id),
    ...existingIncome.map((row) => row.externalId).filter((id): id is string => !!id),
  ]);
}

async function resolveDefaultCategoryId(userId: string, type: 'expense' | 'income'): Promise<number> {
  const [defaultCategory] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(
      eq(categories.userId, userId),
      eq(categories.type, type),
      eq(categories.isImportDefault, true)
    ))
    .limit(1);

  if (defaultCategory?.id) return defaultCategory.id;

  const [fallbackCategory] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.type, type)))
    .limit(1);

  if (fallbackCategory?.id) return fallbackCategory.id;
  throw new Error(await t('errors.categoryNotFound'));
}

/**
 * Resolves fatura month for a Pluggy transaction by looking up the fatura via billId.
 * Falls back to transaction date's month if no billId or fatura found.
 */
function resolveFaturaMonthFromPluggyBill(
  transaction: Transaction,
  faturaMonthByBillId: Map<string, string>,
  transactionDate: string
): string {
  const billId = transaction.creditCardMetadata?.billId;
  if (billId && faturaMonthByBillId.has(billId)) {
    return faturaMonthByBillId.get(billId)!;
  }
  // Fallback: use transaction month
  return transactionDate.slice(0, 7);
}

export async function syncPluggyItem(
  pluggyItemId: string,
  userIdOverride?: string,
  source: PluggySyncSource = 'manual'
): Promise<PluggySyncResult> {
  const syncedAt = new Date();
  const startedAt = Date.now();
  let resolvedUserId: string | null = userIdOverride ?? null;
  let previousErrorCount = 0;
  let isNewItem = false;

  if (!pluggyItemId) {
    return {
      success: false,
      pluggyItemId,
      syncedAt,
      error: await t('errors.failedToLoad'),
    };
  }

  try {
    if (!resolvedUserId) {
      resolvedUserId = await getCurrentUserId();
    }
    const userId = resolvedUserId;
    const isAutoSync = source !== 'manual';

    try {
      await assertOpenFinanceAccess(userId);
    } catch (error) {
      if (isAutoSync) {
        await db
          .update(pluggyItems)
          .set({ nextSyncAt: resolveNextSyncAt(syncedAt), updatedAt: syncedAt })
          .where(and(eq(pluggyItems.userId, userId), eq(pluggyItems.pluggyItemId, pluggyItemId)));
        return {
          success: true,
          pluggyItemId,
          syncedAt,
          accountsSynced: 0,
          accountsCreated: 0,
          transactionsCreated: 0,
          incomeCreated: 0,
          skipped: 0,
        };
      }
      return {
        success: false,
        pluggyItemId,
        syncedAt,
        error: error instanceof Error ? error.message : await t('errors.failedToLoad'),
      };
    }

    const [existingItem] = await db
      .select({
        id: pluggyItems.id,
        errorCount: pluggyItems.errorCount,
        lastSyncedAt: pluggyItems.lastSyncedAt,
        nextSyncAt: pluggyItems.nextSyncAt,
      })
      .from(pluggyItems)
      .where(and(
        eq(pluggyItems.userId, userId),
        eq(pluggyItems.pluggyItemId, pluggyItemId)
      ))
      .limit(1);

    // Determine if this is a first sync (before guards, so we can bypass rate limits)
    isNewItem = !existingItem || !existingItem.lastSyncedAt;
    previousErrorCount = existingItem?.errorCount ?? 0;

    if (isAutoSync && !isNewItem && existingItem?.nextSyncAt && existingItem.nextSyncAt > syncedAt) {
      return {
        success: true,
        pluggyItemId,
        syncedAt,
        accountsSynced: 0,
        accountsCreated: 0,
        transactionsCreated: 0,
        incomeCreated: 0,
        skipped: 0,
      };
    }

    // Bypass Redis rate limit for first sync
    if (isAutoSync && !isNewItem) {
      const autoLimit = await checkPluggyAutoSyncRateLimit(userId, pluggyItemId);
      if (!autoLimit.allowed) {
        await db
          .update(pluggyItems)
          .set({ nextSyncAt: resolveNextSyncAt(syncedAt), updatedAt: syncedAt })
          .where(and(eq(pluggyItems.userId, userId), eq(pluggyItems.pluggyItemId, pluggyItemId)));
        return {
          success: true,
          pluggyItemId,
          syncedAt,
          accountsSynced: 0,
          accountsCreated: 0,
          transactionsCreated: 0,
          incomeCreated: 0,
          skipped: 0,
        };
      }
    }

    const client = getPluggyClient();

    const [expenseCategoryId, incomeCategoryId] = await Promise.all([
      resolveDefaultCategoryId(userId, 'expense'),
      resolveDefaultCategoryId(userId, 'income'),
    ]);

    let itemPayload: Item | null = null;
    try {
      itemPayload = await client.fetchItem(pluggyItemId);
    } catch (error) {
      console.error('[pluggy:sync] Failed to fetch item details:', error);
    }

    const lastUpdatedAt = itemPayload?.lastUpdatedAt ? parseIsoDate(itemPayload.lastUpdatedAt) : null;
    const statusDetail = itemPayload?.error?.message ?? itemPayload?.executionStatus ?? null;
    const connectorId = itemPayload?.connector?.id ? String(itemPayload.connector.id) : null;
    const nextSyncAt = resolveNextSyncAt(syncedAt);
    const itemValues = {
      userId,
      pluggyItemId,
      lastSyncedAt: syncedAt,
      nextSyncAt,
      errorCount: 0,
      updatedAt: syncedAt,
      ...(itemPayload ? {
        connectorId,
        status: itemPayload.status ?? null,
        statusDetail,
        lastUpdatedAt,
      } : {}),
    };

    const itemUpdate = {
      lastSyncedAt: syncedAt,
      nextSyncAt,
      lastError: null, // Clear error on successful sync
      errorCount: 0,
      updatedAt: syncedAt,
      ...(itemPayload ? {
        connectorId,
        status: itemPayload.status ?? null,
        statusDetail,
        lastUpdatedAt,
      } : {}),
    };

    const [pluggyItemRow] = await db
      .insert(pluggyItems)
      .values(itemValues)
      .onConflictDoUpdate({
        target: [pluggyItems.userId, pluggyItems.pluggyItemId],
        set: itemUpdate,
      })
      .returning({ id: pluggyItems.id });

    if (!pluggyItemRow) {
      throw new Error(await t('errors.failedToCreate'));
    }

    const { results: pluggyAccountList } = await client.fetchAccounts(pluggyItemId);

    let accountsSynced = 0;
    let accountsCreated = 0;
    let transactionsCreated = 0;
    let incomeCreated = 0;
    let skipped = 0;

    // Cross-account accumulators for pairing detection
    const allPairCandidates: PairCandidate[] = [];
    // Track fatura payment expenses for auto-matching unpaid faturas
    const faturaPaymentExpenses: Array<{ accountId: number; amountCents: number; date: string }> = [];
    const perAccountIncomeValues: Array<{
      userId: string;
      description: string;
      amount: number;
      categoryId: number;
      accountId: number;
      receivedDate: string;
      receivedAt: Date;
      externalId: string;
      faturaMonth?: string;
      isRefund: boolean;
    }> = [];
    const perAccountAffectedFaturas: Record<number, Set<string>> = {};
    // Track accountId → accountInfo for fatura payment matching
    const accountInfoMap = new Map<number, AccountInfo>();

    for (const pluggyAccount of pluggyAccountList) {
      const { accountId, accountInfo, created } = await ensurePluggyAccountMapping({
        userId,
        pluggyItemRowId: pluggyItemRow.id,
        pluggyAccount,
        itemPayload,
      });
      if (created) accountsCreated += 1;
      accountsSynced += 1;
      accountInfoMap.set(accountId, accountInfo);

      // Sync bills for credit card accounts from Pluggy
      if (accountInfo.type === 'credit_card' && accountInfo.source === 'pluggy') {
        await syncPluggyBills(accountId, pluggyAccount.id, userId);
      }

      const faturaMonthByBillId = new Map<string, string>();
      if (accountInfo.type === 'credit_card') {
        const billRows = await db
          .select({ pluggyBillId: faturas.pluggyBillId, yearMonth: faturas.yearMonth })
          .from(faturas)
          .where(and(
            eq(faturas.userId, userId),
            eq(faturas.accountId, accountId),
            isNotNull(faturas.pluggyBillId)
          ));
        for (const row of billRows) {
          if (row.pluggyBillId) {
            faturaMonthByBillId.set(row.pluggyBillId, row.yearMonth);
          }
        }
      }

      const externalBalanceCents = toCentsMaybe(pluggyAccount.balance);
      const externalCreditLimitCents = toPositiveCentsMaybe(extractCreditLimitValue(pluggyAccount));
      const accountUpdates: Partial<typeof accounts.$inferInsert> = {};

      if (externalBalanceCents !== null) {
        accountUpdates.externalBalanceCents = externalBalanceCents;
        accountUpdates.externalBalanceUpdatedAt = syncedAt;
      }

      if (externalCreditLimitCents !== null) {
        accountUpdates.externalCreditLimitCents = externalCreditLimitCents;
      }

      if (Object.keys(accountUpdates).length > 0) {
        await db
          .update(accounts)
          .set(accountUpdates)
          .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)));
      }

      const cursorScope = `${CURSOR_SCOPE_PREFIX}${pluggyAccount.id}`;
      const [cursor] = await db
        .select()
        .from(pluggySyncCursors)
        .where(and(eq(pluggySyncCursors.itemId, pluggyItemRow.id), eq(pluggySyncCursors.scope, cursorScope)))
        .limit(1);

      const createdAtFrom = cursor?.lastSyncedAt
        ? new Date(cursor.lastSyncedAt.getTime() - CURSOR_BUFFER_MS).toISOString()
        : undefined;

      const accountTransactions = await client.fetchAllTransactions(
        pluggyAccount.id,
        createdAtFrom ? { createdAtFrom } : undefined
      );
      const transactionsByExternalId = new Map<string, Transaction>();
      for (const transaction of accountTransactions) {
        if (!transaction.id) continue;
        transactionsByExternalId.set(namespacedExternalId(transaction.id), transaction);
      }
      const externalIds = accountTransactions
        .map((transaction) => transaction.id)
        .filter((id): id is string => !!id)
        .map(namespacedExternalId);
      const existingIds = await fetchExistingExternalIds(userId, externalIds);
      const seenIds = new Set<string>();

      // Classify all transactions first, collecting candidates per type
      const expenseCandidates: Array<{
        rawId: string;
        externalId: string;
        description: string;
        amountCents: number;
        purchaseDate: string;
        installmentInfo?: { current: number; total: number; baseDescription: string } | undefined;
        isFaturaPayment?: boolean;
        merchantName?: string;
        merchantBusinessName?: string;
        merchantCnpj?: string;
        beneficiaryName?: string;
      }> = [];

      const incomeValues: Array<{
        userId: string;
        description: string;
        amount: number;
        categoryId: number;
        accountId: number;
        receivedDate: string;
        receivedAt: Date;
        externalId: string;
        faturaMonth?: string;
        isRefund: boolean;
        beneficiaryName?: string;
      }> = [];

      const affectedFaturas = new Set<string>();

      for (const transaction of accountTransactions) {
        const rawId = transaction.id;
        if (!rawId) {
          skipped += 1;
          continue;
        }
        const externalId = namespacedExternalId(rawId);
        if (existingIds.has(externalId) || seenIds.has(externalId)) {
          skipped += 1;
          continue;
        }
        seenIds.add(externalId);

        const amountValue = resolveTransactionAmount(transaction);
        if (amountValue === null) {
          skipped += 1;
          continue;
        }

        const date = toDateOnly(transaction.date);
        if (!date) {
          skipped += 1;
          continue;
        }

        const normalizedTransaction = { ...transaction, amount: amountValue };
        const classification = classifyPluggyTransaction(normalizedTransaction);
        const amountCents = amountToCents(amountValue);
        const description = (transaction.description ?? transaction.descriptionRaw ?? '').trim()
          || classification.normalizedDescription
          || 'Transacao Pluggy';

        // Fatura payments → ignored expense on the paying account
        // Extract merchant/beneficiary from Pluggy transaction
        const txMerchantName = transaction.merchant?.name || undefined;
        const txMerchantBusinessName = transaction.merchant?.businessName || undefined;
        const txMerchantCnpj = transaction.merchant?.cnpj || undefined;
        const txBeneficiaryName = classification.direction === 'debit'
          ? transaction.paymentData?.receiver?.name || undefined
          : transaction.paymentData?.payer?.name || undefined;

        if (classification.kind === 'payment') {
          expenseCandidates.push({
            rawId,
            externalId,
            description,
            amountCents,
            purchaseDate: date,
            installmentInfo: undefined,
            isFaturaPayment: true,
            merchantName: txMerchantName,
            merchantBusinessName: txMerchantBusinessName,
            merchantCnpj: txMerchantCnpj,
            beneficiaryName: txBeneficiaryName,
          });
          faturaPaymentExpenses.push({ accountId, amountCents, date });
          continue;
        }

        // Track pair candidates for cross-account internal transfer detection
        if (classification.isPairCandidate) {
          allPairCandidates.push({
            externalId,
            accountId,
            amount: amountCents,
            date,
            direction: classification.direction,
          });
        }

        if (classification.kind === 'refund' || classification.kind === 'income') {
          let faturaMonth: string | undefined;
          if (accountInfo.type === 'credit_card') {
            if (accountInfo.source === 'pluggy') {
              // Pluggy CC: resolve from billId or use transaction month
              faturaMonth = resolveFaturaMonthFromPluggyBill(
                normalizedTransaction,
                faturaMonthByBillId,
                date
              );
              affectedFaturas.add(faturaMonth);
            } else if (accountInfo.closingDay && accountInfo.paymentDueDay) {
              // Manual CC: use closingDay computation
              const receivedDate = new Date(date + 'T00:00:00Z');
              faturaMonth = getFaturaMonth(receivedDate, accountInfo.closingDay);
              affectedFaturas.add(faturaMonth);
            }
          }

          incomeValues.push({
            userId,
            description,
            amount: amountCents,
            categoryId: incomeCategoryId,
            accountId,
            receivedDate: date,
            receivedAt: new Date(date + 'T00:00:00Z'),
            externalId,
            ...(faturaMonth ? { faturaMonth } : {}),
            isRefund: classification.kind === 'refund',
            beneficiaryName: txBeneficiaryName,
          });
          continue;
        }

        // Expense — extract installment info for grouping
        const installmentInfo = extractPluggyInstallmentInfo(normalizedTransaction);
        const basePurchaseDate = toDateOnly(transaction.creditCardMetadata?.purchaseDate)
          ?? (installmentInfo
            ? calculateBasePurchaseDateFromInstallment(date, installmentInfo.current)
            : date);

        expenseCandidates.push({
          rawId,
          externalId,
          description,
          amountCents,
          purchaseDate: basePurchaseDate,
          installmentInfo,
          isFaturaPayment: false,
          merchantName: txMerchantName,
          merchantBusinessName: txMerchantBusinessName,
          merchantCnpj: txMerchantCnpj,
          beneficiaryName: txBeneficiaryName,
        });
      }

      // --- Installment grouping ---
      const { grouped: installmentGroups, singles: singleExpenses } = groupInstallmentTransactions(expenseCandidates);

      // Build expense transaction + entry payloads
      const expenseTransactions: Array<{
        userId: string;
        description: string;
        totalAmount: number;
        totalInstallments: number;
        categoryId: number;
        externalId: string;
        ignored: boolean;
        isFaturaPayment: boolean;
        merchantName?: string;
        merchantBusinessName?: string;
        merchantCnpj?: string;
        beneficiaryName?: string;
      }> = [];

      // Each element maps 1:1 with expenseTransactions — contains N entry metadata rows
      const entryBatches: Array<Array<{
        amount: number;
        purchaseDate: string;
        faturaMonth: string;
        dueDate: string;
        installmentNumber: number;
      }>> = [];

      // Singles: 1 transaction, 1 entry each
      // Preserve actual installment info if available (e.g., single installment from multi-installment purchase)
      for (const tx of singleExpenses) {
        const installmentNumber = tx.installmentInfo?.current ?? 1;
        const totalInstallments = tx.installmentInfo?.total ?? 1;

        // For Pluggy CCs, resolve base fatura month from billId if available
        let overrideBaseFaturaMonth: string | undefined;
        if (accountInfo.type === 'credit_card' && accountInfo.source === 'pluggy') {
          // Find the original transaction to access creditCardMetadata
          const originalTx = transactionsByExternalId.get(tx.externalId);
          if (originalTx?.creditCardMetadata?.billId) {
            const mappedMonth = faturaMonthByBillId.get(originalTx.creditCardMetadata.billId);
            if (mappedMonth) {
              overrideBaseFaturaMonth = mappedMonth;
            }
          }
        }

        const entryDates = computeEntryDates(
          tx.purchaseDate,
          installmentNumber,
          accountInfo,
          undefined,
          overrideBaseFaturaMonth
        );

        if (accountInfo.type === 'credit_card') {
          affectedFaturas.add(entryDates.faturaMonth);
        }

        expenseTransactions.push({
          userId,
          description: tx.description,
          totalAmount: tx.amountCents,
          totalInstallments,
          categoryId: expenseCategoryId,
          externalId: tx.externalId,
          ignored: tx.isFaturaPayment ?? false,
          isFaturaPayment: tx.isFaturaPayment ?? false,
          merchantName: tx.merchantName,
          merchantBusinessName: tx.merchantBusinessName,
          merchantCnpj: tx.merchantCnpj,
          beneficiaryName: tx.beneficiaryName,
        });

        entryBatches.push([{
          amount: tx.amountCents,
          purchaseDate: entryDates.purchaseDate,
          faturaMonth: entryDates.faturaMonth,
          dueDate: entryDates.dueDate,
          installmentNumber,
        }]);
      }

      // Grouped installments: 1 transaction, N entries (only for received installments)
      for (const [, group] of installmentGroups) {
        // Sort entries by installment number
        group.entries.sort((a, b) => a.installmentNumber - b.installmentNumber);

        // Use the earliest entry's purchase date as the base
        const basePurchaseDate = group.entries[0].purchaseDate;

        // Use first entry's externalId as the transaction-level identifier
        const txExternalId = group.entries[0].externalId;

        // For Pluggy CCs, resolve base fatura month from billId of first installment
        let overrideBaseFaturaMonth: string | undefined;
        if (accountInfo.type === 'credit_card' && accountInfo.source === 'pluggy') {
          const firstEntry = group.entries[0];
          const originalTx = transactionsByExternalId.get(firstEntry.externalId);
          if (originalTx?.creditCardMetadata?.billId) {
            const mappedMonth = faturaMonthByBillId.get(originalTx.creditCardMetadata.billId);
            if (mappedMonth) {
              overrideBaseFaturaMonth = mappedMonth;
            }
          }
        }

        // Use merchant data from the first entry of the installment group
        const firstGroupEntry = group.entries[0];
        const firstGroupOriginalTx = transactionsByExternalId.get(firstGroupEntry.externalId);
        expenseTransactions.push({
          userId,
          description: group.baseDescription || 'Compra parcelada',
          totalAmount: group.entries.reduce((sum, e) => sum + e.amount, 0),
          totalInstallments: group.totalInstallments,
          categoryId: expenseCategoryId,
          externalId: txExternalId,
          ignored: false,
          isFaturaPayment: false,
          merchantName: firstGroupOriginalTx?.merchant?.name || undefined,
          merchantBusinessName: firstGroupOriginalTx?.merchant?.businessName || undefined,
          merchantCnpj: firstGroupOriginalTx?.merchant?.cnpj || undefined,
        });

        // CRITICAL FIX: Only create entries for installments we actually received from Pluggy
        // Don't generate phantom entries for missing installments
        const entryRows: Array<{ amount: number; purchaseDate: string; faturaMonth: string; dueDate: string; installmentNumber: number }> = [];
        for (const entry of group.entries) {
          const entryDates = computeEntryDates(
            basePurchaseDate,
            entry.installmentNumber,
            accountInfo,
            undefined,
            overrideBaseFaturaMonth
          );

          if (accountInfo.type === 'credit_card') {
            affectedFaturas.add(entryDates.faturaMonth);
          }

          entryRows.push({
            amount: entry.amount,
            purchaseDate: entryDates.purchaseDate,
            faturaMonth: entryDates.faturaMonth,
            dueDate: entryDates.dueDate,
            installmentNumber: entry.installmentNumber,
          });
        }
        entryBatches.push(entryRows);
      }

      // Collect per-account income for cross-account processing
      perAccountIncomeValues.push(...incomeValues);
      perAccountAffectedFaturas[accountId] = affectedFaturas;

      await db.transaction(async (tx) => {
        if (expenseTransactions.length > 0) {
          const inserted = await tx
            .insert(transactions)
            .values(expenseTransactions)
            .returning({ id: transactions.id });

          const allEntryValues: Array<{
            userId: string;
            transactionId: number;
            accountId: number;
            amount: number;
            purchaseDate: string;
            faturaMonth: string;
            dueDate: string;
            installmentNumber: number;
            paidAt: null;
          }> = [];

          inserted.forEach((row, index) => {
            const batch = entryBatches[index];
            for (const entry of batch) {
              allEntryValues.push({
                userId,
                transactionId: row.id,
                accountId,
                amount: entry.amount,
                purchaseDate: entry.purchaseDate,
                faturaMonth: entry.faturaMonth,
                dueDate: entry.dueDate,
                installmentNumber: entry.installmentNumber,
                paidAt: null,
              });
            }
          });

          if (allEntryValues.length > 0) {
            await tx.insert(entries).values(allEntryValues);
          }
        }
      });

      if (affectedFaturas.size > 0) {
        const months = Array.from(affectedFaturas);
        await batchEnsureFaturasExist(accountId, months, userId);
        await batchUpdateFaturaTotals(accountId, months, userId);
      }

      transactionsCreated += expenseTransactions.length;

      await db
        .insert(pluggySyncCursors)
        .values({
          userId,
          itemId: pluggyItemRow.id,
          scope: cursorScope,
          cursor: syncedAt.toISOString(),
          lastSyncedAt: syncedAt,
          updatedAt: syncedAt,
        })
        .onConflictDoUpdate({
          target: [pluggySyncCursors.itemId, pluggySyncCursors.scope],
          set: {
            cursor: syncedAt.toISOString(),
            lastSyncedAt: syncedAt,
            updatedAt: syncedAt,
          },
        });

      // Update pluggyAccounts lastSyncedAt for this account
      await db
        .update(pluggyAccounts)
        .set({ lastSyncedAt: syncedAt })
        .where(and(
          eq(pluggyAccounts.userId, userId),
          eq(pluggyAccounts.pluggyAccountId, pluggyAccount.id)
        ));
    }

    // --- Cross-account internal transfer pairing ---
    // Detect paired debit↔credit transactions and mark them as ignored internal transfers
    const { expenseExternalIds: pairedExpenseIds, incomeExternalIds: pairedIncomeIds } = detectInternalTransferPairs(allPairCandidates);

    if (pairedExpenseIds.length > 0) {
      await db
        .update(transactions)
        .set({ isInternalTransfer: true, ignored: true })
        .where(and(
          eq(transactions.userId, userId),
          inArray(transactions.externalId, pairedExpenseIds)
        ));
    }

    if (pairedIncomeIds.length > 0) {
      await db
        .update(income)
        .set({ ignored: true })
        .where(and(
          eq(income.userId, userId),
          inArray(income.externalId, pairedIncomeIds)
        ));
    }

    // --- Refund linking: for refund income, find matching expense to update refundedAmount ---
    const refunds = perAccountIncomeValues.filter((i) => i.isRefund);

    for (const refund of refunds) {
      // Search for a matching transaction: same account, amount <= refund amount, not fully refunded
      const [matchingTransaction] = await db
        .select({ id: transactions.id, totalAmount: transactions.totalAmount, refundedAmount: transactions.refundedAmount })
        .from(transactions)
        .innerJoin(entries, eq(entries.transactionId, transactions.id))
        .where(and(
          eq(entries.accountId, refund.accountId),
          eq(transactions.userId, userId),
          eq(transactions.totalAmount, refund.amount),
        ))
        .orderBy(desc(transactions.createdAt))
        .limit(1);

      if (matchingTransaction) {
        const currentRefunded = matchingTransaction.refundedAmount ?? 0;
        const newRefunded = Math.min(currentRefunded + refund.amount, matchingTransaction.totalAmount);
        await db
          .update(transactions)
          .set({ refundedAmount: newRefunded })
          .where(eq(transactions.id, matchingTransaction.id));
      }
    }

    // --- Insert all income (refunds + regular) ---
    if (perAccountIncomeValues.length > 0) {
      await db.insert(income).values(perAccountIncomeValues);
      incomeCreated += perAccountIncomeValues.length;
    }

    // --- Fatura payment auto-matching ---
    // For each detected fatura payment expense, find the matching unpaid fatura by amount
    if (faturaPaymentExpenses.length > 0) {
      const unpaidFaturas = await db
        .select({ id: faturas.id, totalAmount: faturas.totalAmount, dueDate: faturas.dueDate })
        .from(faturas)
        .where(and(eq(faturas.userId, userId), isNull(faturas.paidAt)))
        .orderBy(asc(faturas.dueDate));

      const availableFaturas = [...unpaidFaturas];

      for (const payment of faturaPaymentExpenses) {
        const tolerance = Math.max(Math.round(payment.amountCents * 0.1), 100);
        const matchIndex = availableFaturas.findIndex((fatura) =>
          fatura.totalAmount >= payment.amountCents - tolerance
          && fatura.totalAmount <= payment.amountCents + tolerance
        );

        if (matchIndex >= 0) {
          const [matchingFatura] = availableFaturas.splice(matchIndex, 1);
          await db
            .update(faturas)
            .set({
              paidAt: new Date(payment.date + 'T00:00:00Z'),
              paidFromAccountId: payment.accountId,
            })
            .where(eq(faturas.id, matchingFatura.id));
        }
      }
    }

    // --- Update affected faturas and sync balances per account ---
    for (const acctId of accountInfoMap.keys()) {
      const affected = perAccountAffectedFaturas[acctId];
      if (affected && affected.size > 0) {
        const months = Array.from(affected);
        await batchEnsureFaturasExist(acctId, months, userId);
        await batchUpdateFaturaTotals(acctId, months, userId);
      }
      await syncAccountBalance(acctId, db, userId);
    }

    revalidatePath('/dashboard');
    revalidatePath('/expenses');
    revalidatePath('/faturas');
    revalidatePath('/settings/accounts');
    revalidatePath('/settings/open-finance');

    const durationMs = Date.now() - startedAt;
    console.log('[pluggy:sync] Success', {
      pluggyItemId,
      userId,
      accountsSynced,
      accountsCreated,
      transactionsCreated,
      incomeCreated,
      skipped,
      durationMs,
    });

    const posthog = getPostHogClient();
    if (posthog) {
      const connectorId = itemPayload?.connector?.id ?? null;
      const status = itemPayload?.status ?? null;

      posthog.capture({
        distinctId: userId,
        event: 'pluggy_sync_success',
        properties: {
          pluggy_item_id: pluggyItemId,
          connector_id: connectorId,
          status,
          accounts_synced: accountsSynced,
          accounts_created: accountsCreated,
          transactions_created: transactionsCreated,
          income_created: incomeCreated,
          skipped,
          duration_ms: durationMs,
        },
      });

      if (isNewItem) {
        posthog.capture({
          distinctId: userId,
          event: 'pluggy_connect_success',
          properties: {
            pluggy_item_id: pluggyItemId,
            connector_id: connectorId,
            status,
          },
        });
      }
    }

    // For first sync with no accounts, set a short retry interval (5 min instead of 24h)
    // This handles the case where Pluggy hasn't finished processing the connection yet
    const hasData = pluggyAccountList.length > 0;
    if (isNewItem && !hasData) {
      const shortRetryAt = new Date(syncedAt.getTime() + FIRST_SYNC_RETRY_MS);
      await db
        .update(pluggyItems)
        .set({ nextSyncAt: shortRetryAt })
        .where(and(eq(pluggyItems.userId, userId), eq(pluggyItems.pluggyItemId, pluggyItemId)));
    }

    return {
      success: true,
      pluggyItemId,
      syncedAt,
      accountsSynced,
      accountsCreated,
      transactionsCreated,
      incomeCreated,
      skipped,
    };
  } catch (error) {
    console.error('[pluggy:sync] Failed:', error);
    const errorMessage = await handleDbError(error, 'errors.failedToLoad');
    const errorCount = previousErrorCount + 1;
    const nextSyncAt = resolveErrorBackoffAt(syncedAt, errorCount);

    // Record error in pluggyItems for observability
    try {
      const userId = resolvedUserId ?? userIdOverride ?? await getCurrentUserId();
      await db
        .insert(pluggyItems)
        .values({
          userId,
          pluggyItemId,
          lastError: errorMessage,
          errorCount,
          lastSyncedAt: syncedAt,
          nextSyncAt,
          updatedAt: syncedAt,
        })
        .onConflictDoUpdate({
          target: [pluggyItems.userId, pluggyItems.pluggyItemId],
          set: {
            lastError: errorMessage,
            errorCount,
            lastSyncedAt: syncedAt,
            nextSyncAt,
            updatedAt: syncedAt,
          },
        });

      const durationMs = Date.now() - startedAt;
      const posthog = getPostHogClient();
      if (posthog) {
        posthog.capture({
          distinctId: userId,
          event: 'pluggy_sync_failed',
          properties: {
            pluggy_item_id: pluggyItemId,
            error: errorMessage,
            error_count: errorCount,
            duration_ms: durationMs,
          },
        });

        if (isNewItem) {
          posthog.capture({
            distinctId: userId,
            event: 'pluggy_connect_failed',
            properties: {
              pluggy_item_id: pluggyItemId,
              error: errorMessage,
            },
          });
        }
      }
    } catch (dbError) {
      console.error('[pluggy:sync] Failed to record error:', dbError);
    }

    return {
      success: false,
      pluggyItemId,
      syncedAt,
      error: errorMessage,
    };
  }
}
