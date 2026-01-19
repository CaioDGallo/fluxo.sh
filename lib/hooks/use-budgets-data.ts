'use client';

import { useEffect, useState } from 'react';
import { useMonthStore } from '@/lib/stores/month-store';
import { getBudgetsWithSpending } from '@/lib/actions/budgets';
import { fetchAndCache } from '@/lib/utils/month-fetcher';

type BudgetData = Awaited<ReturnType<typeof getBudgetsWithSpending>>;

export function useBudgetsData(month: string) {
  const getCachedData = useMonthStore((state) => state.getCachedData);

  const [data, setData] = useState<BudgetData | null>(() => getCachedData('budgets', month));
  const [loading, setLoading] = useState(!getCachedData('budgets', month));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const cached = getCachedData('budgets', month);

    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(cached);
      setLoading(false);
      return;
    }

    // Fetch data using centralized fetcher (with deduplication)
    setLoading(true);
    setError(null);

    fetchAndCache('budgets', month)
      .then((result) => {
        setData(result as BudgetData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch budgets data:', err);
        setError(err);
        setLoading(false);
      });
  }, [month, getCachedData]);

  return { data, loading, error };
}
