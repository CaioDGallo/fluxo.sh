'use server';

import { db } from '@/lib/db';
import { transactions, entries, income } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { handleDbError } from '@/lib/db-errors';

export async function resetAllTransactions(): Promise<
  | { success: true; deletedTransactions: number; deletedEntries: number; deletedIncome: number }
  | { success: false; error: string }
> {
  try {
    const userId = await getCurrentUserId();

    const deletedEntriesResult = await db
      .delete(entries)
      .where(eq(entries.userId, userId))
      .returning({ id: entries.id });

    const deletedTransactionsResult = await db
      .delete(transactions)
      .where(eq(transactions.userId, userId))
      .returning({ id: transactions.id });

    const deletedIncomeResult = await db
      .delete(income)
      .where(eq(income.userId, userId))
      .returning({ id: income.id });

    revalidatePath('/expenses');
    revalidatePath('/income');
    revalidatePath('/transfers');
    revalidatePath('/dashboard');
    revalidatePath('/faturas');

    return {
      success: true,
      deletedTransactions: deletedTransactionsResult.length,
      deletedEntries: deletedEntriesResult.length,
      deletedIncome: deletedIncomeResult.length,
    };
  } catch (error) {
    console.error('Failed to reset transactions:', error);
    const errorMessage = await handleDbError(error, 'errors.failedToDelete');
    return { success: false, error: errorMessage };
  }
}
