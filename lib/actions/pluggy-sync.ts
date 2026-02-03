import { getCurrentUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { handleDbError } from '@/lib/db-errors';
import { t } from '@/lib/i18n/server-errors';
import { classifyPluggyTransaction, extractPluggyInstallmentInfo } from '@/lib/pluggy/mapping';
import { getPluggyClient } from '@/lib/pluggy/sdk';
import type { Account, Item, Transaction } from 'pluggy-sdk';
import { ensurePluggyAccountMapping } from '@/lib/pluggy/accounts';
import { computeEntryDates, type AccountInfo } from '@/lib/import-helpers';
import { batchEnsureFaturasExist, batchUpdateFaturaTotals } from '@/lib/actions/faturas';
import { syncAccountBalance } from '@/lib/actions/accounts';
import { getFaturaMonth } from '@/lib/fatura-utils';
import { accounts, categories, entries, faturas, income, pluggyAccounts, pluggyItems, pluggySyncCursors, transactions, transfers } from '@/lib/schema';
import { and, asc, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
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
    transfersCreated: number;
    skipped: number;
  }
  | {
    success: false;
    pluggyItemId: string;
    syncedAt: Date;
    error: string;
  };

const CURSOR_SCOPE_PREFIX = 'transactions:';
const CURSOR_BUFFER_MS = 24 * 60 * 60 * 1000;
const SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;
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
  }>
): { grouped: Map<string, InstallmentGroup>; singles: typeof transactions } {
  const grouped = new Map<string, InstallmentGroup>();
  const singles: typeof transactions = [];

  for (const tx of transactions) {
    if (!tx.installmentInfo || tx.installmentInfo.total <= 1) {
      singles.push(tx);
      continue;
    }

    // Key: baseDescription (normalized) + total installments
    // Collision guard: if same key but different total amounts exist, treat as separate purchases
    const key = `${tx.installmentInfo.baseDescription}|${tx.installmentInfo.total}`;

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

// Transfer candidate for pairing debit/credit sides
type TransferCandidate = {
  externalId: string;
  accountId: number;
  amount: number;
  date: string;
  type: 'fatura_payment' | 'internal_transfer' | 'deposit' | 'withdrawal';
  direction: 'debit' | 'credit';
  description: string;
};

// Pair internal transfers by matching debit ↔ credit with ±1% amount tolerance and same date
function pairInternalTransfers(candidates: TransferCandidate[]): {
  paired: Array<{ fromExternalId: string; toExternalId: string; fromAccountId: number; toAccountId: number; amount: number; date: string; type: string; description: string }>;
  unpaired: TransferCandidate[];
} {
  const paired: Array<{ fromExternalId: string; toExternalId: string; fromAccountId: number; toAccountId: number; amount: number; date: string; type: string; description: string }> = [];
  const usedIds = new Set<string>();

  const debits = candidates.filter((c) => c.direction === 'debit');
  const credits = candidates.filter((c) => c.direction === 'credit');

  for (const debit of debits) {
    if (usedIds.has(debit.externalId)) continue;

    const match = credits.find((credit) => {
      if (usedIds.has(credit.externalId)) return false;
      if (credit.date !== debit.date) return false;
      if (credit.accountId === debit.accountId) return false;
      // Only pair internal_transfer types (not fatura_payment, deposit, withdrawal)
      if (debit.type !== 'internal_transfer' || credit.type !== 'internal_transfer') return false;
      // ±1% tolerance
      const tolerance = Math.max(debit.amount * 0.01, 1);
      return Math.abs(credit.amount - debit.amount) <= tolerance;
    });

    if (match) {
      paired.push({
        fromExternalId: debit.externalId,
        toExternalId: match.externalId,
        fromAccountId: debit.accountId,
        toAccountId: match.accountId,
        amount: debit.amount,
        date: debit.date,
        type: 'internal_transfer',
        description: debit.description,
      });
      usedIds.add(debit.externalId);
      usedIds.add(match.externalId);
    }
  }

  const unpaired = candidates.filter((c) => !usedIds.has(c.externalId));
  return { paired, unpaired };
}

async function fetchExistingExternalIds(userId: string, externalIds: string[]): Promise<Set<string>> {
  const uniqueIds = Array.from(new Set(externalIds.filter((id): id is string => !!id)));
  if (uniqueIds.length === 0) {
    return new Set();
  }

  const [existingTransactions, existingIncome, existingTransfers] = await Promise.all([
    db
      .select({ externalId: transactions.externalId })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.externalId, uniqueIds))),
    db
      .select({ externalId: income.externalId })
      .from(income)
      .where(and(eq(income.userId, userId), inArray(income.externalId, uniqueIds))),
    db
      .select({ externalId: transfers.externalId })
      .from(transfers)
      .where(and(eq(transfers.userId, userId), inArray(transfers.externalId, uniqueIds))),
  ]);

  return new Set([
    ...existingTransactions.map((row) => row.externalId).filter((id): id is string => !!id),
    ...existingIncome.map((row) => row.externalId).filter((id): id is string => !!id),
    ...existingTransfers.map((row) => row.externalId).filter((id): id is string => !!id),
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

export async function syncPluggyItem(
  pluggyItemId: string,
  userIdOverride?: string
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

    const [existingItem] = await db
      .select({
        id: pluggyItems.id,
        errorCount: pluggyItems.errorCount,
        lastSyncedAt: pluggyItems.lastSyncedAt,
      })
      .from(pluggyItems)
      .where(and(
        eq(pluggyItems.userId, userId),
        eq(pluggyItems.pluggyItemId, pluggyItemId)
      ))
      .limit(1);

    isNewItem = !existingItem || !existingItem.lastSyncedAt;
    previousErrorCount = existingItem?.errorCount ?? 0;

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
    let transfersCreated = 0;
    let skipped = 0;

    // Cross-account accumulators for transfer pairing and income
    const allTransferCandidates: TransferCandidate[] = [];
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
      }> = [];

      const transferCandidates: TransferCandidate[] = [];

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

        if (classification.kind === 'transfer' || classification.kind === 'payment') {
          const transferType = classification.transferType ?? (classification.kind === 'payment' ? 'fatura_payment' : 'internal_transfer');
          transferCandidates.push({
            externalId,
            accountId,
            amount: amountCents,
            date,
            type: transferType,
            direction: classification.direction,
            description,
          });
          continue;
        }

        if (classification.kind === 'refund' || classification.kind === 'income') {
          let faturaMonth: string | undefined;
          if (accountInfo.type === 'credit_card' && accountInfo.closingDay && accountInfo.paymentDueDay) {
            const receivedDate = new Date(date + 'T00:00:00Z');
            faturaMonth = getFaturaMonth(receivedDate, accountInfo.closingDay);
            affectedFaturas.add(faturaMonth);
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
          });
          continue;
        }

        // Expense — extract installment info for grouping
        const basePurchaseDate = toDateOnly(transaction.creditCardMetadata?.purchaseDate) ?? date;
        const installmentInfo = extractPluggyInstallmentInfo(normalizedTransaction);

        expenseCandidates.push({
          rawId,
          externalId,
          description,
          amountCents,
          purchaseDate: basePurchaseDate,
          installmentInfo,
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
      for (const tx of singleExpenses) {
        const entryDates = computeEntryDates(tx.purchaseDate, 1, accountInfo);
        if (accountInfo.type === 'credit_card' && accountInfo.closingDay && accountInfo.paymentDueDay) {
          affectedFaturas.add(entryDates.faturaMonth);
        }

        expenseTransactions.push({
          userId,
          description: tx.description,
          totalAmount: tx.amountCents,
          totalInstallments: 1,
          categoryId: expenseCategoryId,
          externalId: tx.externalId,
        });

        entryBatches.push([{
          amount: tx.amountCents,
          purchaseDate: entryDates.purchaseDate,
          faturaMonth: entryDates.faturaMonth,
          dueDate: entryDates.dueDate,
          installmentNumber: 1,
        }]);
      }

      // Grouped installments: 1 transaction, N entries
      for (const [, group] of installmentGroups) {
        // Sort entries by installment number
        group.entries.sort((a, b) => a.installmentNumber - b.installmentNumber);

        // Use the earliest entry's purchase date as the base
        const basePurchaseDate = group.entries[0].purchaseDate;
        const perInstallment = group.entries.length > 0
          ? Math.round(group.entries.reduce((sum, e) => sum + e.amount, 0) / group.totalInstallments)
          : 0;

        // Use first entry's externalId as the transaction-level identifier
        const txExternalId = group.entries[0].externalId;

        expenseTransactions.push({
          userId,
          description: group.baseDescription || 'Compra parcelada',
          totalAmount: group.entries.reduce((sum, e) => sum + e.amount, 0),
          totalInstallments: group.totalInstallments,
          categoryId: expenseCategoryId,
          externalId: txExternalId,
        });

        // Generate entries for ALL installments (even missing ones from partial sync)
        const entryRows: Array<{ amount: number; purchaseDate: string; faturaMonth: string; dueDate: string; installmentNumber: number }> = [];
        for (let i = 1; i <= group.totalInstallments; i++) {
          const entryDates = computeEntryDates(basePurchaseDate, i, accountInfo);
          if (accountInfo.type === 'credit_card' && accountInfo.closingDay && accountInfo.paymentDueDay) {
            affectedFaturas.add(entryDates.faturaMonth);
          }

          // Use actual amount if we have this installment, otherwise estimate
          const actual = group.entries.find((e) => e.installmentNumber === i);
          entryRows.push({
            amount: actual?.amount ?? perInstallment,
            purchaseDate: entryDates.purchaseDate,
            faturaMonth: entryDates.faturaMonth,
            dueDate: entryDates.dueDate,
            installmentNumber: i,
          });
        }
        entryBatches.push(entryRows);
      }

      // --- Transfer processing: collect candidates across all accounts for pairing (done after loop) ---
      // Store per-account transfer candidates for later cross-account pairing
      allTransferCandidates.push(...transferCandidates);
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
        await batchEnsureFaturasExist(accountId, months);
        await batchUpdateFaturaTotals(accountId, months);
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

    // --- Cross-account transfer pairing ---
    const { paired: pairedTransfers, unpaired: unpairedTransfers } = pairInternalTransfers(allTransferCandidates);

    // Insert paired transfers (single row with both from/to)
    if (pairedTransfers.length > 0) {
      const pairedValues = pairedTransfers.map((p) => ({
        userId,
        fromAccountId: p.fromAccountId,
        toAccountId: p.toAccountId,
        amount: p.amount,
        date: p.date,
        type: p.type as 'fatura_payment' | 'internal_transfer' | 'deposit' | 'withdrawal',
        description: p.description,
        externalId: p.fromExternalId, // Use debit side as canonical ID
      }));
      await db.insert(transfers).values(pairedValues);
      transfersCreated += pairedTransfers.length;
    }

    // Insert unpaired transfers (single-sided: deposit, withdrawal, fatura_payment, unmatched internal)
    if (unpairedTransfers.length > 0) {
      const unpairedValues = unpairedTransfers.map((t) => ({
        userId,
        fromAccountId: t.direction === 'debit' ? t.accountId : null,
        toAccountId: t.direction === 'credit' ? t.accountId : null,
        amount: t.amount,
        date: t.date,
        type: t.type,
        description: t.description,
        externalId: t.externalId,
      }));
      await db.insert(transfers).values(unpairedValues);
      transfersCreated += unpairedTransfers.length;
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

    // --- Fatura payment matching for fatura_payment transfers ---
    // Find unpaid faturas matching the transfer amount and mark them paid
    const faturaPayments = unpairedTransfers.filter((t) => t.type === 'fatura_payment');
    for (const payment of faturaPayments) {
      const creditAccountId = payment.direction === 'credit' ? payment.accountId : null;
      if (!creditAccountId) continue;

      // Find the credit card account this payment targets
      const [creditAccount] = await db
        .select({ id: accounts.id, type: accounts.type })
        .from(accounts)
        .where(and(eq(accounts.id, creditAccountId), eq(accounts.userId, userId)))
        .limit(1);

      if (creditAccount?.type !== 'credit_card') continue;

      // Find unpaid fatura closest to payment date with amount tolerance ±10%
      const tolerance = Math.max(Math.round(payment.amount * 0.1), 100);
      const [matchingFatura] = await db
        .select({ id: faturas.id, totalAmount: faturas.totalAmount })
        .from(faturas)
        .where(and(
          eq(faturas.accountId, creditAccountId),
          eq(faturas.userId, userId),
          isNull(faturas.paidAt),
          gte(faturas.totalAmount, payment.amount - tolerance),
          lte(faturas.totalAmount, payment.amount + tolerance),
        ))
        .orderBy(asc(faturas.dueDate))
        .limit(1);

      if (matchingFatura) {
        // Find the from-account for this payment (the debit side)
        const debitCandidate = pairedTransfers.find((p) => p.toAccountId === creditAccountId);
        const fromAccountId = debitCandidate?.fromAccountId ?? payment.accountId;

        await db
          .update(faturas)
          .set({
            paidAt: new Date(payment.date + 'T00:00:00Z'),
            paidFromAccountId: fromAccountId,
          })
          .where(eq(faturas.id, matchingFatura.id));
      }
    }

    // --- Update affected faturas and sync balances per account ---
    for (const acctId of accountInfoMap.keys()) {
      const affected = perAccountAffectedFaturas[acctId];
      if (affected && affected.size > 0) {
        const months = Array.from(affected);
        await batchEnsureFaturasExist(acctId, months);
        await batchUpdateFaturaTotals(acctId, months);
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
      transfersCreated,
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
          transfers_created: transfersCreated,
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

    return {
      success: true,
      pluggyItemId,
      syncedAt,
      accountsSynced,
      accountsCreated,
      transactionsCreated,
      incomeCreated,
      transfersCreated,
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
