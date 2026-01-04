'use server';

import { unstable_cache } from 'next/cache';
import { getAccounts } from './accounts';
import { getCategories } from './categories';
import { getCurrentUserId } from '@/lib/auth';

// Cache accounts for 5 minutes (300 seconds)
// Revalidated via 'accounts' tag when mutations occur
export async function getCachedAccounts() {
  const userId = await getCurrentUserId();
  return unstable_cache(
    async () => getAccounts(),
    ['layout-accounts', userId],
    {
      revalidate: 300,
      tags: ['accounts']
    }
  )();
}

// Cache expense categories for 5 minutes
// Revalidated via category-specific tags
export async function getCachedExpenseCategories() {
  const userId = await getCurrentUserId();
  return unstable_cache(
    async () => getCategories('expense'),
    ['layout-expense-categories', userId],
    {
      revalidate: 300,
      tags: ['categories', 'expense-categories']
    }
  )();
}

// Cache income categories for 5 minutes
// Revalidated via category-specific tags
export async function getCachedIncomeCategories() {
  const userId = await getCurrentUserId();
  return unstable_cache(
    async () => getCategories('income'),
    ['layout-income-categories', userId],
    {
      revalidate: 300,
      tags: ['categories', 'income-categories']
    }
  )();
}
