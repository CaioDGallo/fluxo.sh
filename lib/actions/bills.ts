'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { bills, billOccurrences, categories, accounts, type NewBill } from '@/lib/schema';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';
import { guardCrudOperation } from '@/lib/rate-limit-guard';
import { generateOccurrencesForBill } from '@/lib/actions/bill-occurrences';
import { getCurrentYearMonthInTimeZone } from '@/lib/utils/bill-reminders';
import { getUserSettings } from '@/lib/actions/user-settings';

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── Queries ────────────────────────────────────────────────────────────────

export const getBills = cache(async () => {
  const userId = await getCurrentUserId();
  const settings = await getUserSettings();
  const timeZone = settings?.timezone || 'UTC';
  const currentMonth = getCurrentYearMonthInTimeZone(timeZone);

  return await db
    .select({
      bill: bills,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      accountName: accounts.name,
      currentMonthStatus: sql<string | null>`(
        SELECT ${billOccurrences.status}
        FROM ${billOccurrences}
        WHERE ${billOccurrences.billId} = ${bills.id}
          AND ${billOccurrences.yearMonth} = ${currentMonth}
        LIMIT 1
      )`,
    })
    .from(bills)
    .leftJoin(categories, eq(bills.categoryId, categories.id))
    .leftJoin(accounts, eq(bills.preferredAccountId, accounts.id))
    .where(eq(bills.userId, userId))
    .orderBy(desc(bills.createdAt));
});

export const getBill = cache(async (id: number) => {
  const userId = await getCurrentUserId();

  const [bill] = await db
    .select({
      bill: bills,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      accountName: accounts.name,
    })
    .from(bills)
    .leftJoin(categories, eq(bills.categoryId, categories.id))
    .leftJoin(accounts, eq(bills.preferredAccountId, accounts.id))
    .where(and(eq(bills.id, id), eq(bills.userId, userId)));

  if (!bill) return null;

  // Fetch recent occurrences (last 6 months + upcoming)
  const occurrences = await db
    .select()
    .from(billOccurrences)
    .where(and(
      eq(billOccurrences.billId, id),
      eq(billOccurrences.userId, userId)
    ))
    .orderBy(desc(billOccurrences.dueDate));

  return { ...bill, occurrences };
});

// ─── Mutations ──────────────────────────────────────────────────────────────

export async function createBill(
  data: Omit<NewBill, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<ActionResult<{ id: number }>> {
  try {
    await guardCrudOperation();
    const userId = await getCurrentUserId();

    // Validation
    if (!data.name?.trim()) {
      throw new Error(await t('errors.nameRequired'));
    }
    if (data.dueDay == null) {
      throw new Error(await t('errors.invalidDueDay'));
    }

    const recurrenceType = data.recurrenceType ?? 'monthly';
    if (recurrenceType === 'weekly') {
      if (data.dueDay < 0 || data.dueDay > 6) throw new Error(await t('errors.invalidDueDay'));
    } else if (data.dueDay < 1 || data.dueDay > 31) {
      throw new Error(await t('errors.invalidDueDay'));
    }

    // Verify categoryId/accountId ownership if provided
    if (data.categoryId) {
      const [cat] = await db.select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, data.categoryId), eq(categories.userId, userId)))
        .limit(1);
      if (!cat) return { success: false, error: await t('errors.categoryNotFound') };
    }
    if (data.preferredAccountId) {
      const [acct] = await db.select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.id, data.preferredAccountId), eq(accounts.userId, userId)))
        .limit(1);
      if (!acct) return { success: false, error: await t('errors.accountNotFound') };
    }

    const [bill] = await db
      .insert(bills)
      .values({ ...data, userId, name: data.name.trim() })
      .returning();

    // Generate initial occurrences (3 months rolling window)
    await generateOccurrencesForBill(bill.id, userId);

    revalidatePath('/bills');
    revalidatePath('/dashboard');
    return { success: true, data: { id: bill.id } };
  } catch (error) {
    console.error('[bills:create] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToCreate') };
  }
}

export async function updateBill(
  id: number,
  data: Partial<Omit<NewBill, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<ActionResult> {
  try {
    await guardCrudOperation();
    const userId = await getCurrentUserId();

    // Verify ownership
    const [existing] = await db
      .select()
      .from(bills)
      .where(and(eq(bills.id, id), eq(bills.userId, userId)))
      .limit(1);
    if (!existing) return { success: false, error: await t('errors.categoryNotFound') };

    if (data.name !== undefined && !data.name?.trim()) {
      throw new Error(await t('errors.nameRequired'));
    }

    await db
      .update(bills)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(bills.id, id), eq(bills.userId, userId)));

    // If recurrence settings changed, delete future unpaid occurrences and regenerate
    if (data.recurrenceType !== undefined || data.dueDay !== undefined || data.startMonth !== undefined) {
      const today = new Date().toISOString().split('T')[0];
      await db.delete(billOccurrences).where(and(
        eq(billOccurrences.billId, id),
        eq(billOccurrences.userId, userId),
        inArray(billOccurrences.status, ['upcoming', 'pending']),
        sql`${billOccurrences.dueDate} >= ${today}::date`
      ));
      await generateOccurrencesForBill(id, userId);
    }

    revalidatePath('/bills');
    revalidatePath(`/bills/${id}`);
    return { success: true };
  } catch (error) {
    console.error('[bills:update] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function archiveBill(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    await db
      .update(bills)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(and(eq(bills.id, id), eq(bills.userId, userId)));

    revalidatePath('/bills');
    return { success: true };
  } catch (error) {
    console.error('[bills:archive] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function deleteBill(id: number): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();

    // Only allow deletion if no paid occurrences exist
    const [paidOccurrence] = await db
      .select({ id: billOccurrences.id })
      .from(billOccurrences)
      .where(and(
        eq(billOccurrences.billId, id),
        eq(billOccurrences.userId, userId),
        eq(billOccurrences.status, 'paid')
      ))
      .limit(1);

    if (paidOccurrence) {
      return { success: false, error: await t('errors.failedToDelete') };
    }

    await db
      .delete(bills)
      .where(and(eq(bills.id, id), eq(bills.userId, userId)));

    revalidatePath('/bills');
    return { success: true };
  } catch (error) {
    console.error('[bills:delete] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToDelete') };
  }
}
