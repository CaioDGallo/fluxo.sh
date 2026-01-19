'use client';

import { useEffect, useState } from 'react';
import { getNetWorth, type NetWorthData } from '@/lib/actions/dashboard';

export function useNetWorth() {
  const [data, setData] = useState<NetWorthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getNetWorth()
      .then((result) => {
        setData(result);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch net worth:', err);
        setError(err);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}
