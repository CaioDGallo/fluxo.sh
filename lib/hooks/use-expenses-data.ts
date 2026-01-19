'use client';

import { useEffect, useState } from 'react';
import { useMonthStore } from '@/lib/stores/month-store';
import { getExpenses, type ExpenseFilters } from '@/lib/actions/expenses';
import { fetchAndCache } from '@/lib/utils/month-fetcher';

type ExpenseData = Awaited<ReturnType<typeof getExpenses>>;

export function useExpensesData(filters: ExpenseFilters = {}) {
  const getCachedData = useMonthStore((state) => state.getCachedData);
  const setCachedData = useMonthStore((state) => state.setCachedData);
  const expensesCacheVersion = useMonthStore((state) => state.expensesCacheVersion);

  const month = filters.yearMonth || '';
  const [data, setData] = useState<ExpenseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // If filters beyond month are provided, always fetch fresh
    const hasAdditionalFilters = filters.categoryId || filters.accountId || filters.status !== undefined;

    if (!hasAdditionalFilters && month) {
      const cached = getCachedData('expenses', month);
      if (cached) {
        setData(cached);
        setLoading(false);
        return;
      }
    }

    // Fetch data
    setLoading(true);
    setError(null);

    // Use centralized fetcher for month-only queries (with deduplication)
    const fetchPromise = !hasAdditionalFilters && month
      ? fetchAndCache('expenses', month)
      : getExpenses(filters).then((result) => {
          // Cache if no additional filters
          if (!hasAdditionalFilters && month) {
            setCachedData('expenses', month, result);
          }
          return result;
        });

    fetchPromise
      .then((result) => {
        setData(result as ExpenseData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch expenses data:', err);
        setError(err);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, filters.categoryId, filters.accountId, filters.status, expensesCacheVersion, getCachedData, setCachedData]);

  return { data, loading, error };
}
