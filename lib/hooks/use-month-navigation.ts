'use client';

import { useState } from 'react';
import { useMonthStore } from '@/lib/stores/month-store';
import { addMonths } from '@/lib/utils';
import { fetchAndCache, isDataAvailable, type PageType } from '@/lib/utils/month-fetcher';

/**
 * Trigger directional prefetch based on navigation direction.
 * Prioritizes months in the direction of travel.
 *
 * Example: If user navigates forward (+1), prefetch +2, +3 first
 * Example: If user navigates backward (-1), prefetch -3, -4 first
 */
function triggerDirectionalPrefetch(
  pageType: PageType,
  currentMonth: string,
  direction: -1 | 1
) {
  // Determine prefetch order based on direction
  const monthsToPreload =
    direction === 1
      ? [
          addMonths(currentMonth, 2), // Next month in direction
          addMonths(currentMonth, 3), // Further ahead
          addMonths(currentMonth, -1), // Behind
        ]
      : [
          addMonths(currentMonth, -2), // Previous month in direction
          addMonths(currentMonth, -3), // Further back
          addMonths(currentMonth, 1), // Ahead
        ];

  // Stagger prefetch requests to avoid network congestion
  let delay = 50;
  for (const month of monthsToPreload) {
    if (!isDataAvailable(pageType, month)) {
      setTimeout(() => {
        fetchAndCache(pageType, month).catch(() => {
          // Silently fail prefetch
        });
      }, delay);
      delay += 150;
    }
  }
}

interface UseMonthNavigationProps {
  pageType: PageType;
}

/**
 * Hook for preemptive month navigation with loading states.
 *
 * Key behaviors:
 * - If target month is cached, navigate instantly
 * - If not cached, show loading state on navigation controls (not page content)
 * - Wait for data to load before navigating
 * - Trigger directional prefetch after navigation
 */
export function useMonthNavigation({ pageType }: UseMonthNavigationProps) {
  const currentMonth = useMonthStore((state) => state.currentMonth);
  const setMonth = useMonthStore((state) => state.setMonth);
  const [navigating, setNavigating] = useState(false);

  const navigateMonth = async (direction: -1 | 1) => {
    const target = addMonths(currentMonth, direction);

    // If cached, navigate instantly (no loading state needed)
    if (isDataAvailable(pageType, target)) {
      setMonth(target);
      triggerDirectionalPrefetch(pageType, target, direction);
      return;
    }

    // Otherwise show loading on picker, fetch, then navigate
    setNavigating(true);

    try {
      await fetchAndCache(pageType, target);
      setMonth(target);
      triggerDirectionalPrefetch(pageType, target, direction);
    } catch (error) {
      console.error('Failed to fetch month data:', error);
      // Still navigate even if fetch fails (page will show error state)
      setMonth(target);
    } finally {
      setNavigating(false);
    }
  };

  return { navigateMonth, navigating, currentMonth };
}
