'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { bills, billOccurrences, accounts, entries, transactions, categories } from '@/lib/schema';
import { eq, and, sql, inArray, gte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';
import { guardCrudOperation } from '@/lib/rate-limit-guard';
import { getCurrentYearMonthInTimeZone } from '@/lib/utils/bill-reminders';
import { getUserSettings } from '@/lib/actions/user-settings';

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── Occurrence generation ──────────────────────────────────────────────────

/**
 * Calculate due dates for a bill based on its recurrence type.
 * Returns up to `count` future dates starting from startMonth.
 */
function calculateDueDates(bill: {
  recurrenceType: string;
  dueDay: number;
  startMonth: string;
  endMonth: string | null;
}, count: number, startFromMonth?: string): Date[] {
  const [startYear, startMonthNum] = bill.startMonth.split('-').map(Number);
  const dates: Date[] = [];

  // Determine the earliest month to consider
  let refYear = startYear;
  let refMonth = startMonthNum;
  if (startFromMonth) {
    const [sfYear, sfMonth] = startFromMonth.split('-').map(Number);
    if (sfYear > refYear || (sfYear === refYear && sfMonth > refMonth)) {
      refYear = sfYear;
      refMonth = sfMonth;
    }
  }

  switch (bill.recurrenceType) {
    case 'once': {
      const d = new Date(Date.UTC(startYear, startMonthNum - 1, bill.dueDay));
      if (!bill.endMonth || dateWithinRange(d, bill.startMonth, bill.endMonth)) {
        dates.push(d);
      }
      break;
    }

    case 'weekly': {
      // For weekly, generate from today's week forward
      const now = new Date();
      const current = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      // Find next occurrence of target weekday
      const dayOfWeek = current.getUTCDay();
      let daysUntil = bill.dueDay - dayOfWeek;
      if (daysUntil < 0) daysUntil += 7;
      current.setUTCDate(current.getUTCDate() + daysUntil);

      while (dates.length < count) {
        if (bill.endMonth) {
          const ym = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}`;
          if (ym > bill.endMonth) break;
        }
        dates.push(new Date(current));
        current.setUTCDate(current.getUTCDate() + 7);
      }
      break;
    }

    case 'biweekly': {
      const start = new Date(Date.UTC(startYear, startMonthNum - 1, bill.dueDay));
      const current = new Date(start);
      // Advance to ref point
      while (current < new Date(Date.UTC(refYear, refMonth - 1, 1))) {
        current.setUTCDate(current.getUTCDate() + 14);
      }
      while (dates.length < count) {
        if (bill.endMonth) {
          const ym = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}`;
          if (ym > bill.endMonth) break;
        }
        dates.push(new Date(current));
        current.setUTCDate(current.getUTCDate() + 14);
      }
      break;
    }

    case 'monthly': {
      let y = refYear;
      let m = refMonth;
      while (dates.length < count) {
        if (bill.endMonth) {
          const ym = `${y}-${String(m).padStart(2, '0')}`;
          if (ym > bill.endMonth) break;
        }
        // Clamp day to last day of month
        const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const day = Math.min(bill.dueDay, lastDay);
        dates.push(new Date(Date.UTC(y, m - 1, day)));
        m++;
        if (m > 12) { m = 1; y++; }
      }
      break;
    }

    case 'quarterly': {
      let y = refYear;
      let m = refMonth;
      // Align to start month's quarter cycle
      const startOffset = (startMonthNum - 1) % 3;
      while ((m - 1) % 3 !== startOffset) { m++; if (m > 12) { m = 1; y++; } }

      while (dates.length < count) {
        if (bill.endMonth) {
          const ym = `${y}-${String(m).padStart(2, '0')}`;
          if (ym > bill.endMonth) break;
        }
        const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const day = Math.min(bill.dueDay, lastDay);
        dates.push(new Date(Date.UTC(y, m - 1, day)));
        m += 3;
        if (m > 12) { m -= 12; y++; }
      }
      break;
    }

    case 'yearly': {
      let y = refYear;
      while (dates.length < count) {
        if (bill.endMonth) {
          const ym = `${y}-${String(startMonthNum).padStart(2, '0')}`;
          if (ym > bill.endMonth) break;
        }
        const lastDay = new Date(Date.UTC(y, startMonthNum, 0)).getUTCDate();
        const day = Math.min(bill.dueDay, lastDay);
        dates.push(new Date(Date.UTC(y, startMonthNum - 1, day)));
        y++;
      }
      break;
    }
  }

  return dates;
}

function dateWithinRange(date: Date, startMonth: string, endMonth: string): boolean {
  const ym = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  return ym >= startMonth && ym <= endMonth;
}

function toYearMonth(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Generate occurrences for a bill within a rolling 3-month window.
 * Idempotent — skips dates that already have an occurrence.
 */
export async function generateOccurrencesForBill(billId: number, userId: string): Promise<void> {
  const [bill] = await db
    .select()
    .from(bills)
    .where(and(eq(bills.id, billId), eq(bills.userId, userId)))
    .limit(1);

  if (!bill || bill.status === 'archived') return;

  // Current month as starting point for generation
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Use bill's startMonth or current month, whichever is later
  const startFrom = bill.startMonth > currentYM ? bill.startMonth : currentYM;

  // Generate 3 months of due dates
  const dueDates = calculateDueDates(bill, 3, startFrom);

  // Get existing occurrence dates for dedup
  const existingDates = await db
    .select({ dueDate: billOccurrences.dueDate })
    .from(billOccurrences)
    .where(and(
      eq(billOccurrences.billId, billId),
      eq(billOccurrences.userId, userId)
    ));
  // dueDate from drizzle date() column is already a YYYY-MM-DD string
  const existingDateSet = new Set(existingDates.map(r => String(r.dueDate)));

  // Insert new occurrences
  for (const dueDate of dueDates) {
    const dateStr = dueDate.toISOString().split('T')[0];
    if (existingDateSet.has(dateStr)) continue;

    await db.insert(billOccurrences).values({
      userId,
      billId,
      dueDate: dateStr, // date columns expect YYYY-MM-DD string
      expectedAmount: bill.expectedAmount,
      status: 'upcoming',
      yearMonth: toYearMonth(dueDate),
    });
  }
}

// ─── Queries ────────────────────────────────────────────────────────────────

export const getOccurrencesForMonth = cache(async (yearMonth: string) => {
  const userId = await getCurrentUserId();
  return await db
    .select({
      occurrence: billOccurrences,
      billName: bills.name,
      billRecurrenceType: bills.recurrenceType,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      accountName: accounts.name,
    })
    .from(billOccurrences)
    .leftJoin(bills, eq(billOccurrences.billId, bills.id))
    .leftJoin(categories, eq(bills.categoryId, categories.id))
    .leftJoin(accounts, eq(billOccurrences.paidFromAccountId, accounts.id))
    .where(and(
      eq(billOccurrences.userId, userId),
      eq(billOccurrences.yearMonth, yearMonth)
    ))
    .orderBy(billOccurrences.dueDate);
});

export const getUpcomingOccurrences = cache(async (days: number = 7) => {
  const userId = await getCurrentUserId();
  const now = new Date();
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + days);

  const todayStr = now.toISOString().split('T')[0];
  const futureStr = futureDate.toISOString().split('T')[0];

  return await db
    .select({
      occurrence: billOccurrences,
      billName: bills.name,
      categoryColor: categories.color,
    })
    .from(billOccurrences)
    .leftJoin(bills, eq(billOccurrences.billId, bills.id))
    .leftJoin(categories, eq(bills.categoryId, categories.id))
    .where(and(
      eq(billOccurrences.userId, userId),
      inArray(billOccurrences.status, ['upcoming', 'pending']),
      sql`${billOccurrences.dueDate} >= ${todayStr}::date`,
      sql`${billOccurrences.dueDate} <= ${futureStr}::date`
    ))
    .orderBy(billOccurrences.dueDate);
});

export const getPendingOccurrences = cache(async () => {
  const userId = await getCurrentUserId();
  const settings = await getUserSettings();
  const timeZone = settings?.timezone || 'UTC';
  const currentMonth = getCurrentYearMonthInTimeZone(timeZone);

  return await db
    .select({
      occurrence: billOccurrences,
      billName: bills.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
    })
    .from(billOccurrences)
    .leftJoin(bills, eq(billOccurrences.billId, bills.id))
    .leftJoin(categories, eq(bills.categoryId, categories.id))
    .where(and(
      eq(billOccurrences.userId, userId),
      eq(billOccurrences.yearMonth, currentMonth),
      inArray(billOccurrences.status, ['upcoming', 'pending', 'overdue'])
    ))
    .orderBy(billOccurrences.dueDate);
});

// ─── Mutations ──────────────────────────────────────────────────────────────

export async function markOccurrencePaid(
  id: number,
  data: { actualAmount?: number; paidFromAccountId?: number }
): Promise<ActionResult> {
  try {
    await guardCrudOperation();
    const userId = await getCurrentUserId();

    const [occurrence] = await db
      .select()
      .from(billOccurrences)
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.userId, userId)))
      .limit(1);
    if (!occurrence) return { success: false, error: await t('errors.failedToUpdate') };

    // Verify account ownership if provided
    if (data.paidFromAccountId) {
      const [acct] = await db.select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.id, data.paidFromAccountId), eq(accounts.userId, userId)))
        .limit(1);
      if (!acct) return { success: false, error: await t('errors.accountNotFound') };
    }

    await db
      .update(billOccurrences)
      .set({
        status: 'paid',
        actualAmount: data.actualAmount ?? occurrence.expectedAmount,
        paidFromAccountId: data.paidFromAccountId ?? occurrence.paidFromAccountId,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.userId, userId)));

    revalidatePath('/bills');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('[bill-occurrences:markPaid] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function markOccurrencePaidWithExpense(
  id: number,
  data: {
    actualAmount?: number;
    paidFromAccountId?: number;
    billName: string;
    billCategoryId: number | null;
    createExpense: boolean;
  }
): Promise<ActionResult> {
  try {
    await guardCrudOperation();
    const userId = await getCurrentUserId();

    const [occurrence] = await db
      .select()
      .from(billOccurrences)
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.userId, userId)))
      .limit(1);
    if (!occurrence) return { success: false, error: await t('errors.failedToUpdate') };

    // Verify account ownership if provided
    if (data.paidFromAccountId) {
      const [acct] = await db.select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.id, data.paidFromAccountId), eq(accounts.userId, userId)))
        .limit(1);
      if (!acct) return { success: false, error: await t('errors.accountNotFound') };
    }

    let transactionId: number | null = null;

    // Create expense transaction if requested and bill has category
    if (data.createExpense && data.billCategoryId && data.paidFromAccountId) {
      const amount = data.actualAmount ?? occurrence.expectedAmount ?? 0;
      const dueDate = String(occurrence.dueDate);

      // Create transaction
      const [txn] = await db
        .insert(transactions)
        .values({
          userId,
          description: data.billName,
          categoryId: data.billCategoryId,
          totalAmount: amount,
          totalInstallments: 1,
          ignored: false,
        })
        .returning({ id: transactions.id });

      transactionId = txn.id;

      // Create single entry marked as paid
      await db.insert(entries).values({
        userId,
        transactionId: txn.id,
        accountId: data.paidFromAccountId,
        faturaId: undefined,
        amount,
        dueDate,
        purchaseDate: dueDate,
        faturaMonth: dueDate.slice(0, 7), // YYYY-MM
        installmentNumber: 1,
        paidAt: new Date(),
      });
    }

    // Update occurrence
    await db
      .update(billOccurrences)
      .set({
        status: 'paid',
        actualAmount: data.actualAmount ?? occurrence.expectedAmount,
        paidFromAccountId: data.paidFromAccountId ?? occurrence.paidFromAccountId,
        matchedTransactionId: transactionId,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.userId, userId)));

    revalidatePath('/bills');
    revalidatePath('/dashboard');
    revalidatePath('/expenses');
    return { success: true };
  } catch (error) {
    console.error('[bill-occurrences:markPaidWithExpense] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function linkOccurrenceToTransaction(
  id: number,
  entryId: number
): Promise<ActionResult> {
  try {
    await guardCrudOperation();
    const userId = await getCurrentUserId();

    const [occurrence] = await db
      .select()
      .from(billOccurrences)
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.userId, userId)))
      .limit(1);
    if (!occurrence) return { success: false, error: await t('errors.failedToUpdate') };

    // Verify entry ownership and get transaction info
    const [entry] = await db
      .select({
        id: entries.id,
        amount: entries.amount,
        accountId: entries.accountId,
        transactionId: entries.transactionId,
      })
      .from(entries)
      .where(and(eq(entries.id, entryId), eq(entries.userId, userId)))
      .limit(1);
    if (!entry) return { success: false, error: await t('errors.invalidEntryId') };

    // Sync category: update the transaction's category to match the bill's category
    const [bill] = await db
      .select({ categoryId: bills.categoryId })
      .from(bills)
      .where(eq(bills.id, occurrence.billId))
      .limit(1);

    if (bill?.categoryId && entry.transactionId) {
      const [txn] = await db
        .select({ categoryId: transactions.categoryId })
        .from(transactions)
        .where(eq(transactions.id, entry.transactionId))
        .limit(1);

      if (txn && txn.categoryId !== bill.categoryId) {
        await db
          .update(transactions)
          .set({ categoryId: bill.categoryId })
          .where(eq(transactions.id, entry.transactionId));
      }
    }

    await db
      .update(billOccurrences)
      .set({
        status: 'paid',
        actualAmount: entry.amount,
        paidFromAccountId: entry.accountId,
        matchedTransactionId: entry.transactionId,
        matchedEntryId: entry.id,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.userId, userId)));

    revalidatePath('/bills');
    revalidatePath('/dashboard');
    revalidatePath('/expenses');
    return { success: true };
  } catch (error) {
    console.error('[bill-occurrences:linkTransaction] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function unlinkOccurrence(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    await db
      .update(billOccurrences)
      .set({
        matchedTransactionId: null,
        matchedEntryId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.userId, userId)));

    revalidatePath('/bills');
    return { success: true };
  } catch (error) {
    console.error('[bill-occurrences:unlink] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function skipOccurrence(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    await db
      .update(billOccurrences)
      .set({ status: 'skipped', updatedAt: new Date() })
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.userId, userId)));

    revalidatePath('/bills');
    return { success: true };
  } catch (error) {
    console.error('[bill-occurrences:skip] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function updateOccurrenceAmount(id: number, amount: number): Promise<ActionResult> {
  try {
    await guardCrudOperation();
    const userId = await getCurrentUserId();

    await db
      .update(billOccurrences)
      .set({ expectedAmount: amount, updatedAt: new Date() })
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.userId, userId)));

    revalidatePath('/bills');
    return { success: true };
  } catch (error) {
    console.error('[bill-occurrences:updateAmount] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function acknowledgeOccurrence(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    await db
      .update(billOccurrences)
      .set({ acknowledgedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.userId, userId)));

    return { success: true };
  } catch (error) {
    console.error('[bill-occurrences:acknowledge] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

// ─── Occurrence editing (scoped) ─────────────────────────────────────────────

export async function updateOccurrence(
  id: number,
  data: { expectedAmount?: number; notes?: string },
): Promise<ActionResult> {
  try {
    await guardCrudOperation();
    const userId = await getCurrentUserId();

    const [existing] = await db
      .select()
      .from(billOccurrences)
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.userId, userId)))
      .limit(1);
    if (!existing) return { success: false, error: await t('errors.notFound') };

    await db
      .update(billOccurrences)
      .set({
        ...(data.expectedAmount !== undefined ? { expectedAmount: data.expectedAmount } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(billOccurrences.id, id), eq(billOccurrences.userId, userId)));

    revalidatePath('/bills');
    revalidatePath(`/bills/${existing.billId}`);
    return { success: true };
  } catch (error) {
    console.error('[bill-occurrences:updateOccurrence] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function updateFutureOccurrences(
  occurrenceId: number,
  data: { expectedAmount?: number },
): Promise<ActionResult> {
  try {
    await guardCrudOperation();
    const userId = await getCurrentUserId();

    const [reference] = await db
      .select()
      .from(billOccurrences)
      .where(and(eq(billOccurrences.id, occurrenceId), eq(billOccurrences.userId, userId)))
      .limit(1);
    if (!reference) return { success: false, error: await t('errors.notFound') };

    // Update this and all future unpaid occurrences
    await db
      .update(billOccurrences)
      .set({
        ...(data.expectedAmount !== undefined ? { expectedAmount: data.expectedAmount } : {}),
        updatedAt: new Date(),
      })
      .where(and(
        eq(billOccurrences.billId, reference.billId),
        eq(billOccurrences.userId, userId),
        inArray(billOccurrences.status, ['upcoming', 'pending']),
        gte(billOccurrences.dueDate, String(reference.dueDate)),
      ));

    // Sync bill definition so future auto-generated occurrences match
    if (data.expectedAmount !== undefined) {
      await db
        .update(bills)
        .set({ expectedAmount: data.expectedAmount, updatedAt: new Date() })
        .where(and(eq(bills.id, reference.billId), eq(bills.userId, userId)));
    }

    revalidatePath('/bills');
    revalidatePath(`/bills/${reference.billId}`);
    return { success: true };
  } catch (error) {
    console.error('[bill-occurrences:updateFuture] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function updateAllUnpaidOccurrences(
  billId: number,
  data: { expectedAmount?: number },
): Promise<ActionResult> {
  try {
    await guardCrudOperation();
    const userId = await getCurrentUserId();

    // Update all unpaid occurrences
    await db
      .update(billOccurrences)
      .set({
        ...(data.expectedAmount !== undefined ? { expectedAmount: data.expectedAmount } : {}),
        updatedAt: new Date(),
      })
      .where(and(
        eq(billOccurrences.billId, billId),
        eq(billOccurrences.userId, userId),
        inArray(billOccurrences.status, ['upcoming', 'pending']),
      ));

    // Sync bill definition
    if (data.expectedAmount !== undefined) {
      await db
        .update(bills)
        .set({ expectedAmount: data.expectedAmount, updatedAt: new Date() })
        .where(and(eq(bills.id, billId), eq(bills.userId, userId)));
    }

    revalidatePath('/bills');
    revalidatePath(`/bills/${billId}`);
    return { success: true };
  } catch (error) {
    console.error('[bill-occurrences:updateAllUnpaid] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

/**
 * Get candidate transactions for linking to an occurrence.
 * Matches by amount (±10%) and date (±5 days).
 */
export const getSuggestedTransactions = cache(async (occurrenceId: number) => {
  const userId = await getCurrentUserId();

  const [occurrence] = await db
    .select()
    .from(billOccurrences)
    .where(and(eq(billOccurrences.id, occurrenceId), eq(billOccurrences.userId, userId)))
    .limit(1);

  if (!occurrence || !occurrence.expectedAmount) return [];

  const dueDate = new Date(occurrence.dueDate);
  const minDate = new Date(dueDate);
  minDate.setDate(minDate.getDate() - 5);
  const maxDate = new Date(dueDate);
  maxDate.setDate(maxDate.getDate() + 5);

  const minAmount = Math.floor(occurrence.expectedAmount * 0.9);
  const maxAmount = Math.ceil(occurrence.expectedAmount * 1.1);

  // Get the bill's category for filtering
  const [bill] = await db
    .select({ categoryId: bills.categoryId })
    .from(bills)
    .where(eq(bills.id, occurrence.billId))
    .limit(1);

  return await db
    .select({
      entry: entries,
      description: transactions.description,
      categoryId: transactions.categoryId,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .where(and(
      eq(entries.userId, userId),
      sql`${entries.amount} BETWEEN ${minAmount} AND ${maxAmount}`,
      sql`${entries.purchaseDate} BETWEEN ${minDate.toISOString().split('T')[0]}::date AND ${maxDate.toISOString().split('T')[0]}::date`,
      eq(transactions.ignored, false),
    ))
    .orderBy(
      bill?.categoryId
        ? sql`CASE WHEN ${transactions.categoryId} = ${bill.categoryId} THEN 0 ELSE 1 END`
        : sql`1`,
      entries.purchaseDate,
    )
    .limit(10);
});
