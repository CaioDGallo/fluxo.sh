import { eq } from 'drizzle-orm';
import { transactions, income } from '@/lib/schema';

/**
 * Standard conditions for active (non-ignored) transactions.
 * Use when joining entries -> transactions or querying transactions directly.
 */
export function activeTransactionCondition() {
  return eq(transactions.ignored, false);
}

/**
 * Standard conditions for active (non-ignored) income.
 */
export function activeIncomeCondition() {
  return eq(income.ignored, false);
}
