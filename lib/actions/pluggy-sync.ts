import { getCurrentUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { handleDbError } from '@/lib/db-errors';
import { t } from '@/lib/i18n/server-errors';
import { classifyPluggyTransaction } from '@/lib/pluggy/mapping';
import { getPluggyItem, listPluggyAccounts, listPluggyTransactions, type PluggyAccount as PluggyApiAccount, type PluggyTransaction as PluggyApiTransaction } from '@/lib/pluggy/client';
import { computeEntryDates, type AccountInfo } from '@/lib/import-helpers';
import { batchEnsureFaturasExist, batchUpdateFaturaTotals } from '@/lib/actions/faturas';
import { syncAccountBalance } from '@/lib/actions/accounts';
import { getFaturaMonth } from '@/lib/fatura-utils';
import { accounts, categories, entries, income, pluggyAccounts, pluggyItems, pluggySyncCursors, transactions, transfers } from '@/lib/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

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

const DEFAULT_PAGE_SIZE = 500;
const CURSOR_SCOPE_PREFIX = 'transactions:';
const CURSOR_BUFFER_MS = 24 * 60 * 60 * 1000;

function resolveAccountType(account: PluggyApiAccount): 'credit_card' | 'checking' | 'savings' | 'cash' {
  const type = account.type?.toLowerCase() ?? '';
  const subtype = account.subtype?.toLowerCase() ?? '';

  if (type.includes('credit') || subtype.includes('credit')) return 'credit_card';
  if (type.includes('savings') || subtype.includes('savings')) return 'savings';
  if (type.includes('cash') || subtype.includes('cash')) return 'cash';
  if (type.includes('checking') || subtype.includes('checking') || subtype.includes('transaction')) return 'checking';
  if (type.includes('bank')) return 'checking';
  return 'checking';
}

function resolveAccountName(account: PluggyApiAccount, type: string): string {
  const name = account.marketingName ?? account.name ?? '';
  if (name.trim()) return name.trim();
  if (type === 'credit_card') return 'Cartao Pluggy';
  return 'Conta Pluggy';
}

function toDateOnly(value?: string | null): string | null {
  if (!value) return null;
  const [date] = value.split('T');
  return date || null;
}

function parseIsoDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function resolveTransactionAmount(transaction: PluggyApiTransaction): number | null {
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

function extractCreditLimitValue(account: PluggyApiAccount): number | null {
  if (!account.creditData || typeof account.creditData !== 'object') return null;
  const creditData = account.creditData as Record<string, unknown>;
  const candidates = ['creditLimit', 'limit', 'totalLimit', 'totalCreditLimit'];
  for (const key of candidates) {
    const value = creditData[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
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

async function fetchAllTransactions(accountId: string, createdAtFrom?: string) {
  const transactionsList: PluggyApiTransaction[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const response = await listPluggyTransactions({
      accountId,
      createdAtFrom,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
    });

    transactionsList.push(...response.results);
    totalPages = Math.max(response.totalPages ?? 1, 1);
    page += 1;
  }

  return transactionsList;
}

async function ensureLocalAccount(
  userId: string,
  pluggyItemRowId: number,
  pluggyAccount: PluggyApiAccount,
  itemPayload?: { connectorId?: string | null; [key: string]: unknown } | null
): Promise<{ accountId: number; accountInfo: AccountInfo; created: boolean }> {
  const type = resolveAccountType(pluggyAccount);
  const name = resolveAccountName(pluggyAccount, type);
  const currency = pluggyAccount.currencyCode ?? 'BRL';

  // Extract institution metadata
  const mask = pluggyAccount.number?.slice(-4) ?? null;
  const institutionId = itemPayload?.connectorId ?? null;
  const institutionName =
    (pluggyAccount.bankData && typeof pluggyAccount.bankData === 'object'
      ? (pluggyAccount.bankData as Record<string, unknown>).institution
      : null) as Record<string, unknown> | null;
  const institutionNameStr = institutionName && typeof institutionName.name === 'string'
    ? institutionName.name
    : null;

  const [existingMapping] = await db
    .select()
    .from(pluggyAccounts)
    .where(and(
      eq(pluggyAccounts.userId, userId),
      eq(pluggyAccounts.pluggyAccountId, pluggyAccount.id)
    ))
    .limit(1);

  if (existingMapping) {
    await db
      .update(pluggyAccounts)
      .set({
        itemId: pluggyItemRowId,
        name,
        type: pluggyAccount.type,
        subtype: pluggyAccount.subtype ?? null,
        currency,
        mask,
        institutionId,
        institutionName: institutionNameStr,
        updatedAt: new Date(),
      })
      .where(eq(pluggyAccounts.id, existingMapping.id));

    if (existingMapping.accountId) {
      const [account] = await db
        .select({
          id: accounts.id,
          type: accounts.type,
          closingDay: accounts.closingDay,
          paymentDueDay: accounts.paymentDueDay,
        })
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.id, existingMapping.accountId)))
        .limit(1);

      if (account) {
        return {
          accountId: account.id,
          accountInfo: {
            type: account.type,
            closingDay: account.closingDay ?? null,
            paymentDueDay: account.paymentDueDay ?? null,
          },
          created: false,
        };
      }
    }
  }

  const [createdAccount] = await db
    .insert(accounts)
    .values({
      userId,
      name,
      type,
      source: 'pluggy',
      currency,
    })
    .returning({
      id: accounts.id,
      type: accounts.type,
      closingDay: accounts.closingDay,
      paymentDueDay: accounts.paymentDueDay,
    });

  if (!createdAccount) {
    throw new Error(await t('errors.failedToCreate'));
  }

  if (existingMapping) {
    await db
      .update(pluggyAccounts)
      .set({
        accountId: createdAccount.id,
        updatedAt: new Date(),
      })
      .where(eq(pluggyAccounts.id, existingMapping.id));
  } else {
    await db
      .insert(pluggyAccounts)
      .values({
        userId,
        itemId: pluggyItemRowId,
        pluggyAccountId: pluggyAccount.id,
        accountId: createdAccount.id,
        name,
        type: pluggyAccount.type,
        subtype: pluggyAccount.subtype ?? null,
        currency,
        mask,
        institutionId,
        institutionName: institutionNameStr,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
  }

  return {
    accountId: createdAccount.id,
    accountInfo: {
      type: createdAccount.type,
      closingDay: createdAccount.closingDay ?? null,
      paymentDueDay: createdAccount.paymentDueDay ?? null,
    },
    created: true,
  };
}

export async function syncPluggyItem(pluggyItemId: string): Promise<PluggySyncResult> {
  const syncedAt = new Date();

  if (!pluggyItemId) {
    return {
      success: false,
      pluggyItemId,
      syncedAt,
      error: await t('errors.failedToLoad'),
    };
  }

  try {
    const userId = await getCurrentUserId();

    const [expenseCategoryId, incomeCategoryId] = await Promise.all([
      resolveDefaultCategoryId(userId, 'expense'),
      resolveDefaultCategoryId(userId, 'income'),
    ]);

    let itemPayload: Awaited<ReturnType<typeof getPluggyItem>> | null = null;
    try {
      itemPayload = await getPluggyItem(pluggyItemId);
    } catch (error) {
      console.error('[pluggy:sync] Failed to fetch item details:', error);
    }

    const lastUpdatedAt = itemPayload?.lastUpdatedAt ? parseIsoDate(itemPayload.lastUpdatedAt) : null;
    const itemValues = {
      userId,
      pluggyItemId,
      lastSyncedAt: syncedAt,
      updatedAt: syncedAt,
      ...(itemPayload ? {
        connectorId: itemPayload.connectorId ?? null,
        status: itemPayload.status ?? null,
        statusDetail: itemPayload.statusDetail ?? null,
        lastUpdatedAt,
      } : {}),
    };

    const itemUpdate = {
      lastSyncedAt: syncedAt,
      lastError: null, // Clear error on successful sync
      updatedAt: syncedAt,
      ...(itemPayload ? {
        connectorId: itemPayload.connectorId ?? null,
        status: itemPayload.status ?? null,
        statusDetail: itemPayload.statusDetail ?? null,
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

    const pluggyAccountList = await listPluggyAccounts({ itemId: pluggyItemId });

    let accountsSynced = 0;
    let accountsCreated = 0;
    let transactionsCreated = 0;
    let incomeCreated = 0;
    let transfersCreated = 0;
    let skipped = 0;

    for (const pluggyAccount of pluggyAccountList) {
      const { accountId, accountInfo, created } = await ensureLocalAccount(
        userId,
        pluggyItemRow.id,
        pluggyAccount,
        itemPayload
      );
      if (created) accountsCreated += 1;
      accountsSynced += 1;

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

      const accountTransactions = await fetchAllTransactions(pluggyAccount.id, createdAtFrom);
      const externalIds = accountTransactions.map((transaction) => transaction.id).filter((id): id is string => !!id);
      const existingIds = await fetchExistingExternalIds(userId, externalIds);
      const seenIds = new Set<string>();

      const expenseTransactions: Array<{
        userId: string;
        description: string;
        totalAmount: number;
        totalInstallments: number;
        categoryId: number;
        externalId: string;
      }> = [];

      const entryMetadata: Array<{
        amount: number;
        purchaseDate: string;
        faturaMonth: string;
        dueDate: string;
        installmentNumber: number;
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

      const transferValues: Array<{
        userId: string;
        fromAccountId: number | null;
        toAccountId: number | null;
        amount: number;
        date: string;
        type: 'fatura_payment' | 'internal_transfer' | 'deposit' | 'withdrawal';
        description: string;
        externalId: string;
      }> = [];

      const affectedFaturas = new Set<string>();

      for (const transaction of accountTransactions) {
        const externalId = transaction.id;
        if (!externalId) {
          skipped += 1;
          continue;
        }
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
          transferValues.push({
            userId,
            fromAccountId: classification.direction === 'debit' ? accountId : null,
            toAccountId: classification.direction === 'credit' ? accountId : null,
            amount: amountCents,
            date,
            type: transferType,
            description,
            externalId,
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

        const basePurchaseDate = toDateOnly(transaction.creditCardMetadata?.purchaseDate) ?? date;
        const entryDates = computeEntryDates(basePurchaseDate, 1, accountInfo);
        if (accountInfo.type === 'credit_card' && accountInfo.closingDay && accountInfo.paymentDueDay) {
          affectedFaturas.add(entryDates.faturaMonth);
        }

        expenseTransactions.push({
          userId,
          description,
          totalAmount: amountCents,
          totalInstallments: 1,
          categoryId: expenseCategoryId,
          externalId,
        });

        entryMetadata.push({
          amount: amountCents,
          purchaseDate: entryDates.purchaseDate,
          faturaMonth: entryDates.faturaMonth,
          dueDate: entryDates.dueDate,
          installmentNumber: 1,
        });
      }

      await db.transaction(async (tx) => {
        if (expenseTransactions.length > 0) {
          const inserted = await tx
            .insert(transactions)
            .values(expenseTransactions)
            .returning({ id: transactions.id });

          const entryValues = inserted.map((row, index) => ({
            userId,
            transactionId: row.id,
            accountId,
            amount: entryMetadata[index].amount,
            purchaseDate: entryMetadata[index].purchaseDate,
            faturaMonth: entryMetadata[index].faturaMonth,
            dueDate: entryMetadata[index].dueDate,
            installmentNumber: entryMetadata[index].installmentNumber,
            paidAt: null,
          }));

          await tx.insert(entries).values(entryValues);
        }

        if (incomeValues.length > 0) {
          await tx.insert(income).values(incomeValues);
        }

        if (transferValues.length > 0) {
          await tx.insert(transfers).values(transferValues);
        }
      });

      if (affectedFaturas.size > 0) {
        const months = Array.from(affectedFaturas);
        await batchEnsureFaturasExist(accountId, months);
        await batchUpdateFaturaTotals(accountId, months);
      }

      const updatedCount = expenseTransactions.length + incomeValues.length + transferValues.length;
      if (updatedCount > 0) {
        await syncAccountBalance(accountId, db, userId);
      }

      transactionsCreated += expenseTransactions.length;
      incomeCreated += incomeValues.length;
      transfersCreated += transferValues.length;

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

    revalidatePath('/dashboard');
    revalidatePath('/expenses');
    revalidatePath('/faturas');
    revalidatePath('/settings/accounts');

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

    // Record error in pluggyItems for observability
    try {
      const userId = await getCurrentUserId();
      await db
        .update(pluggyItems)
        .set({ lastError: errorMessage })
        .where(and(
          eq(pluggyItems.userId, userId),
          eq(pluggyItems.pluggyItemId, pluggyItemId)
        ));
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
