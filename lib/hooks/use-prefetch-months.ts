'use client';

import { useEffect } from 'react';
import { useMonthStore } from '@/lib/stores/month-store';
import { addMonths } from '@/lib/utils';
import { getDashboardData } from '@/lib/actions/dashboard';
import { getExpenses } from '@/lib/actions/expenses';
import { getIncome } from '@/lib/actions/income';
import { getBudgetsWithSpending } from '@/lib/actions/budgets';
import { getFaturasByMonth } from '@/lib/actions/faturas';

/**
 * Hook to prefetch adjacent months (±2 window) in the background
 * Only prefetches data that isn't already cached
 */
export function usePrefetchMonths(pageType: 'dashboard' | 'expenses' | 'income' | 'budgets' | 'faturas') {
  const currentMonth = useMonthStore((state) => state.currentMonth);
  const getCachedData = useMonthStore((state) => state.getCachedData);
  const setCachedData = useMonthStore((state) => state.setCachedData);

  useEffect(() => {
    // Calculate adjacent months to prefetch
    const monthsToPreload = [
      addMonths(currentMonth, -2),
      addMonths(currentMonth, -1),
      addMonths(currentMonth, 1),
      addMonths(currentMonth, 2),
    ];

    // Prefetch each month that isn't cached
    for (const month of monthsToPreload) {
      const cached = getCachedData(pageType, month);
      if (cached) continue; // Skip if already cached

      // Prefetch in background (don't await)
      switch (pageType) {
        case 'dashboard':
          getDashboardData(month)
            .then((result) => setCachedData('dashboard', month, result))
            .catch(() => {
              // Silently fail prefetch
            });
          break;
        case 'expenses':
          getExpenses({ yearMonth: month })
            .then((result) => setCachedData('expenses', month, result))
            .catch(() => {});
          break;
        case 'income':
          getIncome({ yearMonth: month })
            .then((result) => setCachedData('income', month, result))
            .catch(() => {});
          break;
        case 'budgets':
          getBudgetsWithSpending(month)
            .then((result) => setCachedData('budgets', month, result))
            .catch(() => {});
          break;
        case 'faturas':
          getFaturasByMonth(month)
            .then((result) => setCachedData('faturas', month, result))
            .catch(() => {});
          break;
      }
    }
  }, [currentMonth, pageType, getCachedData, setCachedData]);
}
