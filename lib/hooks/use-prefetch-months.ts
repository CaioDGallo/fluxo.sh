'use client';

import { useEffect } from 'react';
import { useMonthStore } from '@/lib/stores/month-store';
import { addMonths } from '@/lib/utils';
import { fetchAndCache, isDataAvailable, type PageType } from '@/lib/utils/month-fetcher';

/**
 * Hook to prefetch adjacent months in the background on initial load.
 * Uses staggered requests to avoid network congestion.
 * Prefetch order: closest months first (+1, -1, +2, -2)
 */
export function usePrefetchMonths(pageType: PageType) {
  const currentMonth = useMonthStore((state) => state.currentMonth);

  useEffect(() => {
    // Order: closest months first to improve likely navigation paths
    const monthsToPreload = [
      addMonths(currentMonth, 1),
      addMonths(currentMonth, -1),
      addMonths(currentMonth, 2),
      addMonths(currentMonth, -2),
    ];

    // Stagger prefetch requests to avoid congestion
    let delay = 50;
    for (const month of monthsToPreload) {
      if (!isDataAvailable(pageType, month)) {
        setTimeout(() => {
          fetchAndCache(pageType, month).catch(() => {
            // Silently fail prefetch
          });
        }, delay);
        delay += 150; // Stagger by 150ms
      }
    }
  }, [currentMonth, pageType]);
}
