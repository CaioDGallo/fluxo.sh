'use server';

import { db } from '@/lib/db';
import { transactions, entries, accounts, categories } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ValidatedImportRow } from '@/lib/import/types';

type ImportExpenseData = {
  rows: ValidatedImportRow[];
  accountId: number;
  categoryId: number;
};

type ImportResult =
  | {
      success: true;
      imported: number;
    }
  | {
      success: false;
      error: string;
    };

export async function importExpenses(data: ImportExpenseData): Promise<ImportResult> {
  const { rows, accountId, categoryId } = data;

  if (rows.length === 0) {
    return { success: false, error: 'No valid rows to import' };
  }

  // Validate accountId and categoryId exist
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return { success: false, error: 'Invalid account ID' };
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { success: false, error: 'Invalid category ID' };
  }

  try {
    // Verify account exists
    const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
    if (account.length === 0) {
      return { success: false, error: 'Account not found' };
    }

    // Verify category exists
    const category = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
    if (category.length === 0) {
      return { success: false, error: 'Category not found' };
    }

    // Use transaction for atomicity
    await db.transaction(async (tx) => {
      for (const row of rows) {
        // 1. Create transaction (single installment)
        const [transaction] = await tx
          .insert(transactions)
          .values({
            description: row.description,
            totalAmount: row.amountCents,
            totalInstallments: 1,
            categoryId,
          })
          .returning();

        // 2. Create single entry
        await tx.insert(entries).values({
          transactionId: transaction.id,
          accountId,
          amount: row.amountCents,
          dueDate: row.date,
          installmentNumber: 1,
          paidAt: null,
        });
      }
    });

    revalidatePath('/expenses');
    revalidatePath('/dashboard');

    return { success: true, imported: rows.length };
  } catch (error) {
    console.error('[import:expenses] Failed:', error);
    return { success: false, error: 'Failed to import expenses. Please try again.' };
  }
}
