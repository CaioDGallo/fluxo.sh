'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export type BucketFilter = 'all' | 'necessities' | 'wants' | 'savings';

/**
 * Hook to manage bucket filter state in URL query params
 * Similar to MonthPicker pattern but for ?bucket= param
 */
export function useBucketFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentBucket = (searchParams.get('bucket') || 'all') as BucketFilter;

  const setBucket = useCallback(
    (bucket: BucketFilter) => {
      const params = new URLSearchParams(searchParams.toString());

      if (bucket === 'all') {
        params.delete('bucket');
      } else {
        params.set('bucket', bucket);
      }

      const queryString = params.toString();
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(url);
    },
    [pathname, router, searchParams]
  );

  return {
    currentBucket,
    setBucket,
  };
}
