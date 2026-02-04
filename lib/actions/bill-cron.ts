'use server';

import { db } from '@/lib/db';
import { bills, billOccurrences, userSettings } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { generateOccurrencesForBill } from '@/lib/actions/bill-occurrences';

/**
 * Daily cron: update occurrence statuses based on due dates.
 * upcoming → pending (when due date is today)
 * pending → overdue (when due date has passed)
 */
export async function updateOccurrenceStatuses(): Promise<{
  transitioned: number;
  overdued: number;
}> {
  let transitioned = 0;
  let overdued = 0;

  // Get all users with active bills and their timezones
  const users = await db
    .select({
      userId: bills.userId,
      timezone: userSettings.timezone,
    })
    .from(bills)
    .leftJoin(userSettings, eq(userSettings.userId, bills.userId))
    .where(eq(bills.status, 'active'))
    .groupBy(bills.userId, userSettings.timezone);

  const now = new Date();

  for (const { userId, timezone } of users) {
    const tz = timezone || 'UTC';
    const todayStr = getTodayInTimeZone(tz);

    // upcoming → pending: due date is today or earlier, status is upcoming
    const pendingResult = await db
      .update(billOccurrences)
      .set({ status: 'pending', updatedAt: now })
      .where(and(
        eq(billOccurrences.userId, userId),
        eq(billOccurrences.status, 'upcoming'),
        sql`${billOccurrences.dueDate} <= ${todayStr}::date`
      ))
      .returning({ id: billOccurrences.id });
    transitioned += pendingResult.length;

    // pending → overdue: due date has passed (strictly before today)
    const overdueResult = await db
      .update(billOccurrences)
      .set({ status: 'overdue', updatedAt: now })
      .where(and(
        eq(billOccurrences.userId, userId),
        eq(billOccurrences.status, 'pending'),
        sql`${billOccurrences.dueDate} < ${todayStr}::date`
      ))
      .returning({ id: billOccurrences.id });
    overdued += overdueResult.length;
  }

  console.log('[bill-cron:statusUpdate] Completed:', { transitioned, overdued });
  return { transitioned, overdued };
}

/**
 * Daily cron: generate future occurrences for all active bills.
 * Ensures 3-month rolling window is always populated.
 */
export async function generateFutureOccurrences(): Promise<{
  billsProcessed: number;
}> {
  const activeBills = await db
    .select({ id: bills.id, userId: bills.userId })
    .from(bills)
    .where(eq(bills.status, 'active'));

  for (const bill of activeBills) {
    try {
      await generateOccurrencesForBill(bill.id, bill.userId);
    } catch (error) {
      console.error('[bill-cron:generate] Failed for bill:', bill.id, error);
    }
  }

  console.log('[bill-cron:generate] Processed:', activeBills.length, 'bills');
  return { billsProcessed: activeBills.length };
}

function getTodayInTimeZone(timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}
