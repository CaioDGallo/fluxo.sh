'use client';

import { useEffect, useState } from 'react';
import { useMonthStore } from '@/lib/stores/month-store';
import { getFaturasByMonth } from '@/lib/actions/faturas';
import { fetchAndCache } from '@/lib/utils/month-fetcher';

type FaturaData = Awaited<ReturnType<typeof getFaturasByMonth>>;

export function useFaturasData(month: string) {
  const getCachedData = useMonthStore((state) => state.getCachedData);

  const [data, setData] = useState<FaturaData | null>(() => getCachedData('faturas', month));
  const [loading, setLoading] = useState(!getCachedData('faturas', month));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const cached = getCachedData('faturas', month);

    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(cached);
      setLoading(false);
      return;
    }

    // Fetch data using centralized fetcher (with deduplication)
    setLoading(true);
    setError(null);

    fetchAndCache('faturas', month)
      .then((result) => {
        setData(result as FaturaData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch faturas data:', err);
        setError(err);
        setLoading(false);
      });
  }, [month, getCachedData]);

  return { data, loading, error };
}
