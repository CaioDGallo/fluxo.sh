'use client';

import { useEffect, useState } from 'react';
import { useMonthStore } from '@/lib/stores/month-store';
import { getIncome, type IncomeFilters } from '@/lib/actions/income';
import { fetchAndCache } from '@/lib/utils/month-fetcher';

type IncomeData = Awaited<ReturnType<typeof getIncome>>;

export function useIncomeData(filters: IncomeFilters = {}) {
  const getCachedData = useMonthStore((state) => state.getCachedData);
  const setCachedData = useMonthStore((state) => state.setCachedData);
  const incomeCacheVersion = useMonthStore((state) => state.incomeCacheVersion);

  const month = filters.yearMonth || '';
  const [data, setData] = useState<IncomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // If filters beyond month are provided, always fetch fresh
    const hasAdditionalFilters = filters.categoryId || filters.accountId || filters.status !== undefined;

    if (!hasAdditionalFilters && month) {
      const cached = getCachedData('income', month);
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
      ? fetchAndCache('income', month)
      : getIncome(filters).then((result) => {
          // Cache if no additional filters
          if (!hasAdditionalFilters && month) {
            setCachedData('income', month, result);
          }
          return result;
        });

    fetchPromise
      .then((result) => {
        setData(result as IncomeData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch income data:', err);
        setError(err);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, filters.categoryId, filters.accountId, filters.status, incomeCacheVersion, getCachedData, setCachedData]);

  return { data, loading, error };
}
