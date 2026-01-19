'use client';

import { useEffect, useState } from 'react';
import { useMonthStore } from '@/lib/stores/month-store';
import { type DashboardData } from '@/lib/actions/dashboard';
import { fetchAndCache } from '@/lib/utils/month-fetcher';

export function useDashboardData(month: string) {
  const getCachedData = useMonthStore((state) => state.getCachedData);

  const [data, setData] = useState<DashboardData | null>(() => getCachedData('dashboard', month));
  const [loading, setLoading] = useState(!getCachedData('dashboard', month));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const cached = getCachedData('dashboard', month);

    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(cached);
      setLoading(false);
      return;
    }

    // Fetch data using centralized fetcher (with deduplication)
    setLoading(true);
    setError(null);

    fetchAndCache('dashboard', month)
      .then((result) => {
        setData(result as DashboardData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch dashboard data:', err);
        setError(err);
        setLoading(false);
      });
  }, [month, getCachedData]);

  return { data, loading, error };
}
