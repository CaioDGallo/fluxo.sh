'use client';

import { useEffect, useState } from 'react';
import { useMonthStore } from '@/lib/stores/month-store';
import { getDashboardData, type DashboardData } from '@/lib/actions/dashboard';

export function useDashboardData(month: string) {
  const getCachedData = useMonthStore((state) => state.getCachedData);
  const setCachedData = useMonthStore((state) => state.setCachedData);

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

    // Fetch data if not cached
    setLoading(true);
    setError(null);

    getDashboardData(month)
      .then((result) => {
        setCachedData('dashboard', month, result);
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch dashboard data:', err);
        setError(err);
        setLoading(false);
      });
  }, [month, getCachedData, setCachedData]);

  return { data, loading, error };
}
