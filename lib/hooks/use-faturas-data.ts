'use client';

import { useEffect, useState } from 'react';
import { useMonthStore } from '@/lib/stores/month-store';
import { getFaturasByMonth } from '@/lib/actions/faturas';

type FaturaData = Awaited<ReturnType<typeof getFaturasByMonth>>;

export function useFaturasData(month: string) {
  const getCachedData = useMonthStore((state) => state.getCachedData);
  const setCachedData = useMonthStore((state) => state.setCachedData);

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

    // Fetch data if not cached
    setLoading(true);
    setError(null);

    getFaturasByMonth(month)
      .then((result) => {
        setCachedData('faturas', month, result);
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch faturas data:', err);
        setError(err);
        setLoading(false);
      });
  }, [month, getCachedData, setCachedData]);

  return { data, loading, error };
}
