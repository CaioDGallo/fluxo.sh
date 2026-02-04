'use server';

import { getCurrentUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { computeClosingDate, computeFaturaWindowStart, getFaturaPaymentDueDate, getCurrentYearMonth, addMonths, getFaturaMonth } from '@/lib/fatura-utils';
import { t } from '@/lib/i18n/server-errors';
import { checkBulkRateLimit } from '@/lib/rate-limit';
import { accounts, categories, entries, faturas, income, transactions, type Fatura } from '@/lib/schema';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { cache } from 'react';
import { syncAccountBalance } from '@/lib/actions/accounts';
import { getPostHogClient } from '@/lib/posthog-server';
import { trackUserActivity } from '@/lib/analytics';
import { getPluggyClient } from '@/lib/pluggy/sdk';

export type UnpaidFatura = {
  id: number;
  accountId: number;
  accountName: string;
  yearMonth: string;
  totalAmount: number;
  dueDate: string;
};

/**
 * Ensures a fatura exists for a given account and month.
 * Creates it if it doesn't exist.
 *
 * @param overrides - Optional custom dates (e.g., from OFX import)
 *   - closingDate: Actual closing date (overrides computed from account default)
 *   - dueDate: Actual due date (overrides computed from account default)
 */
export async function ensureFaturaExists(
  accountId: number,
  yearMonth: string,
  overrides?: { closingDate?: string; dueDate?: string; startDate?: string }
): Promise<Fatura> {
  const userId = await getCurrentUserId();

  // Check if fatura exists
  const existing = await db
    .select()
    .from(faturas)
    .where(and(eq(faturas.userId, userId), eq(faturas.accountId, accountId), eq(faturas.yearMonth, yearMonth)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Get account to compute dates
  const account = await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, accountId))).limit(1);

  if (!account[0]) {
    throw new Error(await t('errors.accountNotFound'));
  }

  // For non-credit cards or cards without billing config, use first day of next month
  const paymentDueDay = account[0].paymentDueDay || 1;
  const closingDay = account[0].closingDay || 1;

  // Use overrides if provided, otherwise compute from account defaults
  const closingDate = overrides?.closingDate ?? computeClosingDate(yearMonth, closingDay);

  // If closingDate override provided without dueDate, calculate dueDate as +7 days
  let paymentDueDate: string;
  if (overrides?.dueDate) {
    paymentDueDate = overrides.dueDate;
  } else if (overrides?.closingDate) {
    // When closingDate is overridden, default to 7 days after closing
    const closingDateObj = new Date(overrides.closingDate);
    closingDateObj.setDate(closingDateObj.getDate() + 7);
    paymentDueDate = closingDateObj.toISOString().split('T')[0];
  } else {
    // No overrides, use account defaults
    paymentDueDate = getFaturaPaymentDueDate(yearMonth, paymentDueDay, closingDay);
  }

  // Create fatura
  const [fatura] = await db
    .insert(faturas)
    .values({
      userId,
      accountId,
      yearMonth,
      closingDate,
      startDate: overrides?.startDate ?? null,
      totalAmount: 0,
      dueDate: paymentDueDate,
    })
    .returning();

  return fatura;
}

/**
 * Updates the total amount for a fatura by summing all its entries.
 * CRITICAL: Only updates manual faturas - Pluggy faturas use bank's authoritative amount.
 *
 * @param accountIdOrFaturaId - Either accountId (number) + yearMonth OR faturaId alone
 * @param yearMonth - Optional yearMonth if first param is accountId
 */
export async function updateFaturaTotal(accountIdOrFaturaId: number, yearMonth?: string): Promise<void> {
  const userId = await getCurrentUserId();

  // Support both calling patterns: (accountId, yearMonth) OR (faturaId)
  let faturaId: number;
  if (yearMonth !== undefined) {
    // Old pattern: (accountId, yearMonth)
    const [fatura] = await db
      .select({ id: faturas.id, pluggyBillId: faturas.pluggyBillId })
      .from(faturas)
      .where(and(eq(faturas.userId, userId), eq(faturas.accountId, accountIdOrFaturaId), eq(faturas.yearMonth, yearMonth)))
      .limit(1);

    if (!fatura) return;
    if (fatura.pluggyBillId) return; // Pluggy fatura - trust bank's amount

    faturaId = fatura.id;
  } else {
    // New pattern: (faturaId)
    faturaId = accountIdOrFaturaId;

    const [fatura] = await db
      .select({ pluggyBillId: faturas.pluggyBillId })
      .from(faturas)
      .where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId)))
      .limit(1);

    if (!fatura) return;
    if (fatura.pluggyBillId) return; // Pluggy fatura - trust bank's amount
  }

  // Sum all entries for this fatura using faturaId
  const entriesResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${entries.amount}), 0)` })
    .from(entries)
    .where(and(eq(entries.userId, userId), eq(entries.faturaId, faturaId)));

  const entriesTotal = entriesResult[0]?.total || 0;

  // Sum all refunds for this fatura (income records linked via faturaId)
  // Note: income table doesn't have faturaId yet, so we still use (accountId, faturaMonth) for refunds
  const [fatura] = await db
    .select({ accountId: faturas.accountId, yearMonth: faturas.yearMonth })
    .from(faturas)
    .where(eq(faturas.id, faturaId))
    .limit(1);

  let refundsTotal = 0;
  if (fatura) {
    const refundsResult = await db
      .select({ total: sql<number>`COALESCE(SUM(${income.amount}), 0)` })
      .from(income)
      .where(
        and(
          eq(income.userId, userId),
          eq(income.accountId, fatura.accountId),
          eq(income.faturaMonth, fatura.yearMonth),
          sql`(${income.refundOfTransactionId} IS NOT NULL OR ${income.isRefund} = true)`
        )
      );

    refundsTotal = refundsResult[0]?.total || 0;
  }

  // Net total = entries - refunds
  const totalAmount = entriesTotal - refundsTotal;

  await db
    .update(faturas)
    .set({ totalAmount })
    .where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId)));
}

/**
 * Gets the fatura window start date for a given account and month.
 *
 * The start date is determined in this order:
 * 1. If the fatura exists and has an explicit startDate override, use that
 * 2. If the previous fatura exists, use its closingDate + 1 day
 * 3. Fall back to computing from account's closingDay
 *
 * @param accountId - The credit card account ID
 * @param yearMonth - Fatura month in "YYYY-MM" format
 * @param closingDay - Account's default closing day (used as fallback)
 * @returns Start date of the billing window in "YYYY-MM-DD" format
 */
export async function getFaturaWindowStart(
  accountId: number,
  yearMonth: string,
  closingDay: number
): Promise<string> {
  const userId = await getCurrentUserId();

  // Check if this fatura exists with an explicit startDate
  const fatura = await db
    .select({ startDate: faturas.startDate })
    .from(faturas)
    .where(
      and(
        eq(faturas.userId, userId),
        eq(faturas.accountId, accountId),
        eq(faturas.yearMonth, yearMonth)
      )
    )
    .limit(1);

  if (fatura[0]?.startDate) {
    return fatura[0].startDate;
  }

  // Check if previous fatura exists to get its closing date
  const [year, month] = yearMonth.split('-').map(Number);
  const prevMonthDate = new Date(Date.UTC(year, month - 2, 1));
  const prevYearMonth = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;

  const prevFatura = await db
    .select({ closingDate: faturas.closingDate })
    .from(faturas)
    .where(
      and(
        eq(faturas.userId, userId),
        eq(faturas.accountId, accountId),
        eq(faturas.yearMonth, prevYearMonth)
      )
    )
    .limit(1);

  if (prevFatura[0]?.closingDate) {
    // Window starts day after previous fatura's closing date
    const closingDate = new Date(prevFatura[0].closingDate + 'T00:00:00Z');
    closingDate.setUTCDate(closingDate.getUTCDate() + 1);
    return closingDate.toISOString().split('T')[0];
  }

  // Fall back to computed value from account defaults
  return computeFaturaWindowStart(yearMonth, closingDay);
}

/**
 * Updates the closing date and/or due date for a specific fatura.
 * Used when actual billing dates differ from account defaults (e.g., weekend shifts).
 */
export async function updateFaturaDates(
  faturaId: number,
  data: { closingDate?: string; dueDate?: string; startDate?: string | null }
): Promise<void> {
  if (!Number.isInteger(faturaId) || faturaId <= 0) {
    throw new Error(await t('errors.invalidFaturaId'));
  }

  if (!data.closingDate && !data.dueDate && data.startDate === undefined) {
    throw new Error('At least one date must be provided');
  }

  const userId = await getCurrentUserId();

  // Verify fatura exists and belongs to user
  const fatura = await db
    .select()
    .from(faturas)
    .where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId)))
    .limit(1);

  if (!fatura[0]) {
    throw new Error(await t('errors.faturaNotFound'));
  }

  // Guard: prevent modifying paid faturas
  if (fatura[0].paidAt) {
    throw new Error('Cannot modify dates on a paid fatura');
  }

  // Update dates
  const updates: { closingDate?: string; dueDate?: string; startDate?: string | null } = {};
  if (data.closingDate) updates.closingDate = data.closingDate;
  if (data.dueDate) updates.dueDate = data.dueDate;
  if (data.startDate !== undefined) updates.startDate = data.startDate;

  await db
    .update(faturas)
    .set(updates)
    .where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId)));

  // When closingDate or startDate changes, entries may need to move between faturas
  // Reassign entries on THIS account to ensure they're in the correct fatura
  if (data.closingDate || data.startDate !== undefined) {
    await reassignEntriesToFaturas(fatura[0].accountId, undefined, userId);
  }

  // Recalculate installment dates for entries in this fatura
  // This is needed when startDate changes
  await recalculateInstallmentDates(fatura[0].accountId, fatura[0].yearMonth);

  // If closingDate changed, also recalculate the NEXT fatura's entries
  // because its window start is calculated from this fatura's closing date
  if (data.closingDate) {
    const [year, month] = fatura[0].yearMonth.split('-').map(Number);
    const nextMonth = new Date(Date.UTC(year, month, 1)); // month is 1-indexed, Date uses 0-indexed, so this gives next month
    const nextYearMonth = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}`;
    await recalculateInstallmentDates(fatura[0].accountId, nextYearMonth);
  }

  revalidateTag(`user-${userId}`, {});
  revalidatePath('/faturas');
  revalidatePath('/expenses');
}

/**
 * Recalculates the purchaseDate for installment entries in a fatura.
 *
 * For entries that are part of multi-installment transactions (installmentNumber > 1),
 * this updates their purchaseDate to the fatura's window start date.
 *
 * This should be called when:
 * - A fatura's startDate or closingDate changes
 * - Previous fatura's closingDate changes (affects this fatura's calculated startDate)
 *
 * @param accountId - The credit card account ID
 * @param yearMonth - Fatura month in "YYYY-MM" format
 */
export async function recalculateInstallmentDates(
  accountId: number,
  yearMonth: string
): Promise<void> {
  const userId = await getCurrentUserId();

  // Get account's closing day for fallback calculation
  const account = await db
    .select({ closingDay: accounts.closingDay })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
    .limit(1);

  if (!account[0]?.closingDay) {
    // Non-credit card or no billing config - nothing to do
    return;
  }

  // Get the fatura window start date
  const windowStart = await getFaturaWindowStart(accountId, yearMonth, account[0].closingDay);

  // Find all entries in this fatura that are part of multi-installment transactions
  // and have installmentNumber > 1 (subsequent installments)
  const entriesToUpdate = await db
    .select({
      entryId: entries.id,
      installmentNumber: entries.installmentNumber,
      totalInstallments: transactions.totalInstallments,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .where(
      and(
        eq(entries.userId, userId),
        eq(entries.accountId, accountId),
        eq(entries.faturaMonth, yearMonth),
        sql`${transactions.totalInstallments} > 1`,
        sql`${entries.installmentNumber} > 1`
      )
    );

  // Bulk update entry purchaseDates to the fatura window start
  if (entriesToUpdate.length > 0) {
    const entryIds = entriesToUpdate.map((e) => e.entryId);
    await db.update(entries).set({ purchaseDate: windowStart }).where(inArray(entries.id, entryIds));
  }
}

/**
 * Batch ensures faturas exist for multiple months.
 * Creates missing faturas for the given account and months.
 * Returns a map of yearMonth → faturaId for all requested months.
 */
export async function batchEnsureFaturasExist(
  accountId: number,
  months: string[],
  userIdOverride?: string
): Promise<Map<string, number>> {
  if (months.length === 0) return new Map();

  const userId = userIdOverride ?? await getCurrentUserId();

  // Get account to compute dates
  const account = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
    .limit(1);

  if (!account[0]) {
    throw new Error(await t('errors.accountNotFound'));
  }

  const paymentDueDay = account[0].paymentDueDay || 1;
  const closingDay = account[0].closingDay || 1;

  // Check which faturas already exist
  const existingFaturas = await db
    .select({ id: faturas.id, yearMonth: faturas.yearMonth })
    .from(faturas)
    .where(and(eq(faturas.userId, userId), eq(faturas.accountId, accountId), inArray(faturas.yearMonth, months)));

  const faturaMap = new Map(existingFaturas.map(f => [f.yearMonth, f.id]));
  const missingMonths = months.filter((m) => !faturaMap.has(m));

  if (missingMonths.length > 0) {
    // Bulk insert missing faturas
    const faturaValues = missingMonths.map((yearMonth) => ({
      userId,
      accountId,
      yearMonth,
      closingDate: computeClosingDate(yearMonth, closingDay),
      startDate: null,
      totalAmount: 0,
      dueDate: getFaturaPaymentDueDate(yearMonth, paymentDueDay, closingDay),
    }));

    const newFaturas = await db.insert(faturas).values(faturaValues).returning({ id: faturas.id, yearMonth: faturas.yearMonth });

    // Add new faturas to map
    for (const fatura of newFaturas) {
      faturaMap.set(fatura.yearMonth, fatura.id);
    }
  }

  return faturaMap;
}

/**
 * Batch updates fatura totals for multiple months.
 * Uses a subquery to calculate all totals in a single UPDATE.
 */
export async function batchUpdateFaturaTotals(
  accountId: number,
  months: string[],
  userIdOverride?: string
): Promise<void> {
  if (months.length === 0) return;

  const userId = userIdOverride ?? await getCurrentUserId();

  // Update all fatura totals in a single query using subqueries
  // Use IN clause instead of ANY for array parameter compatibility
  // CRITICAL: Only update manual faturas - Pluggy faturas use bank's authoritative amount
  const monthsCondition = sql.join(months.map(m => sql`${m}`), sql`, `);

  await db.execute(sql`
    UPDATE faturas
    SET total_amount = COALESCE(entries_total, 0) - COALESCE(refunds_total, 0)
    FROM (
      SELECT
        f.id AS fatura_id,
        SUM(e.amount) AS entries_total
      FROM faturas f
      LEFT JOIN entries e ON e.fatura_id = f.id AND e.user_id = f.user_id
      WHERE f.user_id = ${userId}
        AND f.account_id = ${accountId}
        AND f.year_month IN (${monthsCondition})
      GROUP BY f.id
    ) AS entries_agg
    FULL OUTER JOIN (
      SELECT
        f.id AS fatura_id,
        SUM(i.amount) AS refunds_total
      FROM faturas f
      LEFT JOIN income i ON i.account_id = f.account_id
        AND i.fatura_month = f.year_month
        AND i.user_id = f.user_id
        AND (i.refund_of_transaction_id IS NOT NULL OR i.is_refund = true)
      WHERE f.user_id = ${userId}
        AND f.account_id = ${accountId}
        AND f.year_month IN (${monthsCondition})
      GROUP BY f.id
    ) AS refunds_agg
    ON entries_agg.fatura_id = refunds_agg.fatura_id
    WHERE faturas.id = COALESCE(entries_agg.fatura_id, refunds_agg.fatura_id)
      AND faturas.pluggy_bill_id IS NULL
  `);
}

/**
 * Batch recalculates installment dates for multiple months.
 * Updates entry purchaseDates for installments within the fatura window.
 */
export async function batchRecalculateInstallmentDates(
  accountId: number,
  months: string[]
): Promise<void> {
  if (months.length === 0) return;

  const userId = await getCurrentUserId();

  // Get account billing config
  const account = await db
    .select({ closingDay: accounts.closingDay })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
    .limit(1);

  if (!account[0]?.closingDay) return;

  const closingDay = account[0].closingDay;

  // For each month, compute window start and update entries
  for (const yearMonth of months) {
    const windowStart = computeFaturaWindowStart(yearMonth, closingDay);

    const entriesToUpdate = await db
      .select({ entryId: entries.id })
      .from(entries)
      .innerJoin(transactions, eq(entries.transactionId, transactions.id))
      .where(
        and(
          eq(entries.userId, userId),
          eq(entries.accountId, accountId),
          eq(entries.faturaMonth, yearMonth),
          sql`${transactions.totalInstallments} > 1`,
          sql`${entries.installmentNumber} > 1`
        )
      );

    if (entriesToUpdate.length > 0) {
      const entryIds = entriesToUpdate.map((e) => e.entryId);
      await db.update(entries).set({ purchaseDate: windowStart }).where(inArray(entries.id, entryIds));
    }
  }
}

/**
 * Syncs credit card bills from Pluggy and upserts faturas.
 * Called during syncPluggyItem for credit card accounts.
 */
export async function syncPluggyBills(
  accountId: number,
  pluggyAccountId: string,
  userId: string
): Promise<void> {
  const client = getPluggyClient();

  try {
    const billsResponse = await client.fetchCreditCardBills(pluggyAccountId);
    const bills = billsResponse.results || [];

    for (const bill of bills) {
      // Extract yearMonth from bill dueDate
      const dueDate = bill.dueDate instanceof Date ? bill.dueDate : new Date(bill.dueDate);
      const yearMonth = dueDate.toISOString().slice(0, 7);

      // Compute closing date (typically dueDate - typical offset, e.g., 7 days)
      const closingDate = new Date(dueDate);
      closingDate.setDate(closingDate.getDate() - 7);
      const closingDateStr = closingDate.toISOString().slice(0, 10);

      const totalAmount = Math.round(Math.abs(bill.totalAmount ?? 0) * 100); // Convert to cents

      await db.insert(faturas).values({
        userId,
        accountId,
        yearMonth,
        pluggyBillId: bill.id,
        dueDate: dueDate.toISOString().slice(0, 10),
        closingDate: closingDateStr,
        startDate: null,
        totalAmount,
      }).onConflictDoUpdate({
        target: [faturas.accountId, faturas.pluggyBillId],
        set: {
          dueDate: dueDate.toISOString().slice(0, 10),
          totalAmount,
        },
      });
    }
  } catch (error) {
    console.error('[faturas] Failed to sync Pluggy bills:', error);
    // Don't throw - continue with sync even if bills fetch fails
  }
}

/**
 * Ensures recent faturas exist for manual credit card accounts.
 * Creates empty faturas for current month + next 2 months.
 */
export async function ensureRecentFaturasExist(
  accountId: number,
  userId: string
): Promise<void> {
  const [account] = await db.select().from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId)));

  if (!account || account.type !== 'credit_card') return;
  if (account.source === 'pluggy') return; // Pluggy CCs get faturas from bills sync
  if (!account.closingDay || !account.paymentDueDay) return;

  // Create faturas for current month + next 2 months
  const currentMonth = getCurrentYearMonth();
  const months = [currentMonth, addMonths(currentMonth, 1), addMonths(currentMonth, 2)];

  await batchEnsureFaturasExist(accountId, months, userId);
}

/**
 * Gets all faturas for a specific account, ordered by month descending.
 */
export const getFaturasByAccount = cache(async (accountId: number) => {
  const userId = await getCurrentUserId();

  return await db
    .select()
    .from(faturas)
    .where(and(eq(faturas.userId, userId), eq(faturas.accountId, accountId)))
    .orderBy(desc(faturas.yearMonth));
});

/**
 * Gets all faturas for a specific month across all credit card accounts.
 * Auto-creates empty faturas for manual CCs if they don't exist.
 */
export const getFaturasByMonth = cache(async (yearMonth: string) => {
  const userId = await getCurrentUserId();

  // Ensure recent faturas exist for all manual CCs (on-demand creation)
  const creditCards = await db.select().from(accounts)
    .where(and(
      eq(accounts.userId, userId),
      eq(accounts.type, 'credit_card'),
      eq(accounts.source, 'manual')
    ));

  for (const cc of creditCards) {
    await ensureRecentFaturasExist(cc.id, userId);
  }

  return await db
    .select({
      id: faturas.id,
      accountId: faturas.accountId,
      accountName: accounts.name,
      yearMonth: faturas.yearMonth,
      closingDate: faturas.closingDate,
      totalAmount: faturas.totalAmount,
      dueDate: faturas.dueDate,
      paidAt: sql<string | null>`${faturas.paidAt}::text`,
      paidFromAccountId: faturas.paidFromAccountId,
    })
    .from(faturas)
    .innerJoin(accounts, eq(faturas.accountId, accounts.id))
    .where(and(eq(faturas.userId, userId), eq(faturas.yearMonth, yearMonth)))
    .orderBy(accounts.name);
});

/**
 * Gets all unpaid faturas across all credit card accounts.
 */
export const getUnpaidFaturas = cache(async (): Promise<UnpaidFatura[]> => {
  const userId = await getCurrentUserId();

  return await db
    .select({
      id: faturas.id,
      accountId: faturas.accountId,
      accountName: accounts.name,
      yearMonth: faturas.yearMonth,
      totalAmount: faturas.totalAmount,
      dueDate: faturas.dueDate,
    })
    .from(faturas)
    .innerJoin(accounts, eq(faturas.accountId, accounts.id))
    .where(and(
      eq(faturas.userId, userId),
      isNull(faturas.paidAt)
    ))
    .orderBy(desc(faturas.yearMonth), accounts.name);
});

/**
 * Gets fatura details including all entries.
 */
export const getFaturaWithEntries = cache(async (faturaId: number) => {
  const userId = await getCurrentUserId();

  const fatura = await db.select().from(faturas).where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId))).limit(1);

  if (!fatura[0]) {
    return null;
  }

  // Fetch entries using faturaId FK
  const faturaEntries = await db
    .select({
      id: entries.id,
      amount: entries.amount,
      purchaseDate: entries.purchaseDate,
      dueDate: entries.dueDate,
      paidAt: sql<string | null>`${entries.paidAt}::text`,
      installmentNumber: entries.installmentNumber,
      transactionId: transactions.id,
      description: transactions.description,
      totalInstallments: transactions.totalInstallments,
      categoryId: categories.id,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(eq(entries.userId, userId), eq(entries.faturaId, faturaId)))
    .orderBy(desc(entries.purchaseDate));

  // Get refunds for this fatura (income records still use accountId + faturaMonth)
  const faturaRefunds = await db
    .select({
      id: income.id,
      description: income.description,
      amount: income.amount,
      receivedDate: income.receivedDate,
      receivedAt: sql<string | null>`${income.receivedAt}::text`,
      transactionId: income.refundOfTransactionId,
      categoryId: categories.id,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
    })
    .from(income)
    .leftJoin(categories, eq(income.categoryId, categories.id))
    .where(
      and(
        eq(income.userId, userId),
        eq(income.accountId, fatura[0].accountId),
        eq(income.faturaMonth, fatura[0].yearMonth)
      )
    )
    .orderBy(desc(income.receivedDate));

  return {
    ...fatura[0],
    entries: faturaEntries,
    refunds: faturaRefunds,
  };
});

/**
 * Marks a fatura as paid from a specific account.
 * Also marks all entries in the fatura as paid.
 */
export async function payFatura(faturaId: number, fromAccountId: number): Promise<void> {
  if (!Number.isInteger(faturaId) || faturaId <= 0) {
    throw new Error(await t('errors.invalidFaturaId'));
  }
  if (!Number.isInteger(fromAccountId) || fromAccountId <= 0) {
    throw new Error(await t('errors.invalidAccountId'));
  }

  try {
    const userId = await getCurrentUserId();
    const now = new Date();
    const paymentDate = now.toISOString().split('T')[0];

    await db.transaction(async (tx) => {
      // 1. Get fatura details
      const fatura = await tx
        .select()
        .from(faturas)
        .where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId)))
        .limit(1);

      if (!fatura[0]) {
        throw new Error(await t('errors.faturaNotFound'));
      }

      if (fatura[0].paidAt) {
        throw new Error(await t('errors.faturaAlreadyPaid'));
      }

      // 2. Verify source account exists and is not a credit card
      const sourceAccount = await tx
        .select()
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.id, fromAccountId)))
        .limit(1);

      if (!sourceAccount[0]) {
        throw new Error(await t('errors.accountNotFound'));
      }

      if (sourceAccount[0].type === 'credit_card') {
        throw new Error(await t('errors.cannotPayFromCreditCard'));
      }

      // 3. Create ignored expense transaction on paying account (fatura payment)
      const expenseCategory = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.userId, userId), eq(categories.type, 'expense'), eq(categories.isImportDefault, true)))
        .limit(1);
      const categoryId = expenseCategory[0]?.id ?? (await tx
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.userId, userId), eq(categories.type, 'expense')))
        .limit(1))[0]?.id;

      if (!categoryId) {
        throw new Error(await t('errors.categoryNotFound'));
      }

      const [paymentTx] = await tx
        .insert(transactions)
        .values({
          userId,
          description: `Fatura ${fatura[0].yearMonth}`,
          totalAmount: fatura[0].totalAmount,
          totalInstallments: 1,
          categoryId,
          ignored: true,
          isFaturaPayment: true,
        })
        .returning({ id: transactions.id });

      await tx.insert(entries).values({
        userId,
        transactionId: paymentTx.id,
        accountId: fromAccountId,
        amount: fatura[0].totalAmount,
        purchaseDate: paymentDate,
        faturaMonth: fatura[0].yearMonth,
        dueDate: paymentDate,
        paidAt: now,
        installmentNumber: 1,
      });

      // 4. Mark fatura as paid
      await tx
        .update(faturas)
        .set({
          paidAt: now,
          paidFromAccountId: fromAccountId,
        })
        .where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId)));

      // 5. Mark all entries in this fatura as paid (using faturaId)
      await tx
        .update(entries)
        .set({ paidAt: now })
        .where(and(eq(entries.userId, userId), eq(entries.faturaId, faturaId)));

      await syncAccountBalance(fromAccountId, tx, userId);
      await syncAccountBalance(fatura[0].accountId, tx, userId);
    });

    // Analytics: Track user activity
    await trackUserActivity({
      userId,
      activityType: 'pay_fatura',
    });

    // PostHog event tracking
    const posthog = getPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: userId,
        event: 'fatura_paid',
        properties: {
          fatura_id: faturaId,
          from_account_id: fromAccountId,
        },
      });
    }

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/faturas');
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/settings/accounts');
  } catch (error) {
    console.error('Failed to pay fatura:', { faturaId, fromAccountId, error });
    throw error instanceof Error ? error : new Error(await t('errors.failedToPay'));
  }
}

/**
 * Marks a fatura as unpaid (reverses payment).
 */
export async function markFaturaUnpaid(faturaId: number): Promise<void> {
  if (!Number.isInteger(faturaId) || faturaId <= 0) {
    throw new Error(await t('errors.invalidFaturaId'));
  }

  try {
    const userId = await getCurrentUserId();

    await db.transaction(async (tx) => {
      // Get fatura details
      const fatura = await tx
        .select()
        .from(faturas)
        .where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId)))
        .limit(1);

      if (!fatura[0]) {
        throw new Error(await t('errors.faturaNotFound'));
      }

      const paidFromAccountId = fatura[0].paidFromAccountId;

      // Mark fatura as unpaid
      await tx
        .update(faturas)
        .set({
          paidAt: null,
          paidFromAccountId: null,
        })
        .where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId)));

      // Mark all entries in this fatura as unpaid (using faturaId)
      await tx
        .update(entries)
        .set({ paidAt: null })
        .where(and(eq(entries.userId, userId), eq(entries.faturaId, faturaId)));

      // Delete the fatura payment transaction (ignored expense on paying account)
      if (paidFromAccountId) {
        const [paymentTx] = await tx
          .select({ id: transactions.id })
          .from(transactions)
          .innerJoin(entries, eq(entries.transactionId, transactions.id))
          .where(and(
            eq(transactions.userId, userId),
            eq(transactions.isFaturaPayment, true),
            eq(transactions.description, `Fatura ${fatura[0].yearMonth}`),
            eq(entries.accountId, paidFromAccountId)
          ))
          .limit(1);

        if (paymentTx) {
          await tx.delete(transactions).where(eq(transactions.id, paymentTx.id));
        }
      }

      const affectedAccounts = new Set<number>();
      if (paidFromAccountId) {
        affectedAccounts.add(paidFromAccountId);
      }
      affectedAccounts.add(fatura[0].accountId);
      for (const accountId of affectedAccounts) {
        await syncAccountBalance(accountId, tx, userId);
      }
    });

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/faturas');
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/settings/accounts');
  } catch (error) {
    console.error('Failed to mark fatura unpaid:', { faturaId, error });
    throw error instanceof Error ? error : new Error(await t('errors.failedToMarkPending'));
  }
}

/**
 * Converts an expense (from checking/savings/cash) into a fatura payment.
 * Marks the existing transaction as ignored with isFaturaPayment flag.
 */
export async function convertExpenseToFaturaPayment(entryId: number, faturaId: number): Promise<void> {
  if (!Number.isInteger(entryId) || entryId <= 0) {
    throw new Error(await t('errors.invalidTransactionId'));
  }
  if (!Number.isInteger(faturaId) || faturaId <= 0) {
    throw new Error(await t('errors.invalidFaturaId'));
  }

  try {
    const userId = await getCurrentUserId();

    await db.transaction(async (tx) => {
      // 1. Load entry + transaction, validate ownership
      const entry = await tx
        .select({
          entryId: entries.id,
          entryAmount: entries.amount,
          purchaseDate: entries.purchaseDate,
          transactionId: entries.transactionId,
          accountId: entries.accountId,
        })
        .from(entries)
        .where(and(eq(entries.userId, userId), eq(entries.id, entryId)))
        .limit(1);

      if (!entry[0]) {
        throw new Error(await t('errors.invalidTransactionId'));
      }

      const transaction = await tx
        .select({
          id: transactions.id,
          totalInstallments: transactions.totalInstallments,
          externalId: transactions.externalId,
        })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.id, entry[0].transactionId)))
        .limit(1);

      if (!transaction[0]) {
        throw new Error(await t('errors.invalidTransactionId'));
      }

      // 2. Validate: accountType !== credit_card, totalInstallments === 1
      const sourceAccount = await tx
        .select({ type: accounts.type })
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.id, entry[0].accountId)))
        .limit(1);

      if (!sourceAccount[0]) {
        throw new Error(await t('errors.accountNotFound'));
      }

      if (sourceAccount[0].type === 'credit_card') {
        throw new Error(await t('errors.invalidConversion'));
      }

      if (transaction[0].totalInstallments !== 1) {
        throw new Error(await t('errors.invalidConversion'));
      }

      // 3. Load fatura, validate unpaid + amount matches entry.amount
      const fatura = await tx
        .select()
        .from(faturas)
        .where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId)))
        .limit(1);

      if (!fatura[0]) {
        throw new Error(await t('errors.faturaNotFound'));
      }

      if (fatura[0].paidAt) {
        throw new Error(await t('errors.faturaAlreadyPaid'));
      }

      if (fatura[0].totalAmount !== entry[0].entryAmount) {
        throw new Error(await t('errors.amountMismatch'));
      }

      // 4. Convert the existing expense into an ignored fatura payment
      const paymentTimestamp = new Date(entry[0].purchaseDate);

      await tx
        .update(transactions)
        .set({
          ignored: true,
          isFaturaPayment: true,
          description: `Fatura ${fatura[0].yearMonth}`,
        })
        .where(eq(transactions.id, entry[0].transactionId));

      // 5. Mark fatura paid
      await tx
        .update(faturas)
        .set({
          paidAt: paymentTimestamp,
          paidFromAccountId: entry[0].accountId,
        })
        .where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId)));

      // 6. Mark all fatura entries as paid (using faturaId)
      await tx
        .update(entries)
        .set({ paidAt: paymentTimestamp })
        .where(and(eq(entries.userId, userId), eq(entries.faturaId, faturaId)));

      // 7. Sync both account balances
      await syncAccountBalance(entry[0].accountId, tx, userId);
      await syncAccountBalance(fatura[0].accountId, tx, userId);
    });

    // 9. Revalidate paths
    revalidateTag(`user-${userId}`, {});
    revalidatePath('/faturas');
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/settings/accounts');
  } catch (error) {
    console.error('Failed to convert expense to fatura payment:', { entryId, faturaId, error });
    throw error instanceof Error ? error : new Error(await t('errors.failedToUpdate'));
  }
}

/**
 * Reassigns all entries for an account to the correct faturas based on purchase dates.
 *
 * This function recalculates which fatura each entry should belong to based on:
 * - The entry's purchaseDate
 * - The actual fatura window dates (startDate, closingDate)
 * - Account's default closingDay (as fallback)
 *
 * Key rules:
 * - Entries in PAID faturas are FROZEN - never reassigned
 * - Multi-installment transactions move together as a unit
 * - Pluggy fatura entries CAN be reassigned (membership is local, amount is bank's)
 * - After reassignment, faturaMonth is always synced with faturas.yearMonth via faturaId
 *
 * @param accountId - The credit card account to reassign entries for
 * @param txOverride - Optional transaction context (for use within existing transaction)
 * @param userIdOverride - Optional userId (for use within existing transaction)
 */
export async function reassignEntriesToFaturas(
  accountId: number,
  txOverride?: typeof db,
  userIdOverride?: string
): Promise<void> {
  const userId = userIdOverride ?? await getCurrentUserId();
  const dbCtx = txOverride ?? db;

  // Get account billing config
  const [account] = await dbCtx
    .select({ closingDay: accounts.closingDay, paymentDueDay: accounts.paymentDueDay })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
    .limit(1);

  if (!account?.closingDay || !account?.paymentDueDay) {
    // Non-credit card or no billing config - nothing to reassign
    return;
  }

  const { closingDay, paymentDueDay } = account;

  // Get all faturas for this account, sorted by yearMonth
  const faturasForAccount = await dbCtx
    .select()
    .from(faturas)
    .where(and(eq(faturas.userId, userId), eq(faturas.accountId, accountId)))
    .orderBy(faturas.yearMonth);

  const faturaMap = new Map(faturasForAccount.map(f => [f.yearMonth, f]));
  const paidFaturaMonths = new Set(
    faturasForAccount.filter(f => f.paidAt).map(f => f.yearMonth)
  );

  // Build fatura windows with actual dates
  // Each fatura has a window: [startDate, closingDate]
  type FaturaWindow = {
    yearMonth: string;
    startDate: Date;
    closingDate: Date;
    fatura: typeof faturasForAccount[0];
  };

  const faturaWindows: FaturaWindow[] = [];
  for (const fatura of faturasForAccount) {
    // Get window start: use explicit startDate or calculate from previous fatura
    let startDate: Date;
    if (fatura.startDate) {
      startDate = new Date(fatura.startDate + 'T00:00:00Z');
    } else {
      // Calculate from previous fatura's closing date + 1 day
      const windowStart = await getFaturaWindowStart(accountId, fatura.yearMonth, closingDay);
      startDate = new Date(windowStart + 'T00:00:00Z');
    }

    const closingDate = new Date(fatura.closingDate + 'T00:00:00Z');

    faturaWindows.push({
      yearMonth: fatura.yearMonth,
      startDate,
      closingDate,
      fatura,
    });
  }

  /**
   * Determines which fatura a purchase date belongs to based on actual fatura windows.
   * Returns the yearMonth of the matching fatura, or null if no match.
   */
  const findFaturaForPurchase = (purchaseDate: Date): string | null => {
    console.log('[reassignEntriesToFaturas] Finding fatura for purchase date:', purchaseDate.toISOString().split('T')[0]);
    console.log('[reassignEntriesToFaturas] Available windows:', faturaWindows.map(w => ({
      month: w.yearMonth,
      start: w.startDate.toISOString().split('T')[0],
      close: w.closingDate.toISOString().split('T')[0],
    })));

    // Find the fatura window that contains this purchase date
    for (const window of faturaWindows) {
      // Purchase must be after or on startDate and on or before closingDate
      if (purchaseDate >= window.startDate && purchaseDate <= window.closingDate) {
        console.log('[reassignEntriesToFaturas] Match found:', window.yearMonth);
        return window.yearMonth;
      }
    }

    // No existing window found - compute using default logic
    const fallback = getFaturaMonth(purchaseDate, closingDay);
    console.log('[reassignEntriesToFaturas] No window match, using fallback:', fallback);
    return fallback;
  };

  // Get all entries for this account, grouped by transactionId
  const allEntries = await dbCtx
    .select({
      entryId: entries.id,
      transactionId: entries.transactionId,
      purchaseDate: entries.purchaseDate,
      currentFaturaMonth: entries.faturaMonth,
      installmentNumber: entries.installmentNumber,
      amount: entries.amount,
      totalInstallments: transactions.totalInstallments,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .where(and(eq(entries.userId, userId), eq(entries.accountId, accountId)))
    .orderBy(entries.transactionId, entries.installmentNumber);

  // Group entries by transaction
  const entriesByTransaction = new Map<number, typeof allEntries>();
  for (const entry of allEntries) {
    const group = entriesByTransaction.get(entry.transactionId) ?? [];
    group.push(entry);
    entriesByTransaction.set(entry.transactionId, group);
  }

  const affectedFaturaMonths = new Set<string>();

  // Process each transaction
  for (const transactionEntries of entriesByTransaction.values()) {
    // Skip if ANY entry is in a paid fatura (entire transaction is frozen)
    if (transactionEntries.some(e => paidFaturaMonths.has(e.currentFaturaMonth))) {
      continue;
    }

    // Find installment 1 (the base purchase)
    const firstInstallment = transactionEntries.find(e => e.installmentNumber === 1);
    if (!firstInstallment) {
      console.warn(`Transaction ${transactionEntries[0].transactionId} missing installment 1`);
      continue;
    }

    // Determine which fatura the first installment belongs to using actual windows
    const purchaseDate = new Date(firstInstallment.purchaseDate + 'T00:00:00Z');
    console.log('[reassignEntriesToFaturas] Processing transaction', transactionEntries[0].transactionId, 'with', transactionEntries.length, 'installments');
    console.log('[reassignEntriesToFaturas] First installment purchase date:', firstInstallment.purchaseDate);
    const baseFaturaMonth = findFaturaForPurchase(purchaseDate);

    if (!baseFaturaMonth) {
      console.warn(`Could not determine fatura for purchase on ${firstInstallment.purchaseDate}`);
      continue;
    }

    // For each installment, calculate its new fatura month
    for (const entry of transactionEntries) {
      const installmentIndex = entry.installmentNumber - 1;
      const newFaturaMonth = addMonths(baseFaturaMonth, installmentIndex);

      console.log(`[reassignEntriesToFaturas] Entry ${entry.entryId}: installment ${entry.installmentNumber}/${entry.totalInstallments}, currently in ${entry.currentFaturaMonth}, should be in ${newFaturaMonth}`);

      // Track old fatura month for recalculation
      affectedFaturaMonths.add(entry.currentFaturaMonth);
      affectedFaturaMonths.add(newFaturaMonth);

      // Skip if already in correct fatura
      if (entry.currentFaturaMonth === newFaturaMonth) {
        console.log(`[reassignEntriesToFaturas] Entry ${entry.entryId}: already in correct fatura, skipping`);
        continue;
      }

      console.log(`[reassignEntriesToFaturas] Entry ${entry.entryId}: moving from ${entry.currentFaturaMonth} to ${newFaturaMonth}`);

      // Ensure fatura exists for new month
      let newFatura = faturaMap.get(newFaturaMonth);
      if (!newFatura) {
        newFatura = await ensureFaturaExists(accountId, newFaturaMonth);
        faturaMap.set(newFaturaMonth, newFatura);
      }

      // Compute new dueDate based on new fatura
      const newDueDate = getFaturaPaymentDueDate(newFaturaMonth, paymentDueDay, closingDay);

      // Update entry: move to new fatura
      await dbCtx
        .update(entries)
        .set({
          faturaMonth: newFaturaMonth,
          faturaId: newFatura.id,
          dueDate: newDueDate,
        })
        .where(eq(entries.id, entry.entryId));
    }
  }

  // Recalculate totals for all affected faturas (both old and new)
  for (const faturaMonth of affectedFaturaMonths) {
    await updateFaturaTotal(accountId, faturaMonth);
  }
}

/**
 * Backfills fatura records for existing credit card entries.
 * Creates faturas for all distinct (accountId, faturaMonth) combinations
 * where entries exist but no fatura record exists yet.
 */
export async function backfillFaturas(): Promise<{ created: number } | { error: string }> {
  try {
    const userId = await getCurrentUserId();

    const rateLimit = await checkBulkRateLimit(userId);
    if (!rateLimit.allowed) {
      return { error: await t('errors.tooManyAttempts', { retryAfter: rateLimit.retryAfter }) };
    }

    // Get all distinct (accountId, faturaMonth) combinations from entries
    // Only for credit card accounts
    const distinctCombinations = await db
      .selectDistinct({
        accountId: entries.accountId,
        faturaMonth: entries.faturaMonth,
      })
      .from(entries)
      .innerJoin(accounts, eq(entries.accountId, accounts.id))
      .where(and(eq(entries.userId, userId), eq(accounts.type, 'credit_card')));

    let created = 0;

    // For each combination, ensure fatura exists and update total
    for (const combo of distinctCombinations) {
      const existing = await db
        .select()
        .from(faturas)
        .where(and(
          eq(faturas.userId, userId),
          eq(faturas.accountId, combo.accountId),
          eq(faturas.yearMonth, combo.faturaMonth)
        ))
        .limit(1);

      // Skip if fatura already exists
      if (existing.length > 0) continue;

      // Create fatura using existing utility
      await ensureFaturaExists(combo.accountId, combo.faturaMonth);

      // Update total amount
      await updateFaturaTotal(combo.accountId, combo.faturaMonth);

      created++;
    }

    return { created };
  } catch (error) {
    console.error('Failed to backfill faturas:', error);
    return { error: await t('errors.failedToBackfillFaturas') };
  }
}
