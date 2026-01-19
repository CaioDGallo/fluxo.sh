import { getDashboardData } from '@/lib/actions/dashboard';
import { getExpenses } from '@/lib/actions/expenses';
import { getIncome } from '@/lib/actions/income';
import { getBudgetsWithSpending } from '@/lib/actions/budgets';
import { getFaturasByMonth } from '@/lib/actions/faturas';
import { useMonthStore } from '@/lib/stores/month-store';

// Type for page types
export type PageType = 'dashboard' | 'expenses' | 'income' | 'budgets' | 'faturas';

// Track in-flight requests to prevent duplicates (module-level, not React state)
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Centralized fetch with automatic deduplication and caching.
 *
 * Behavior:
 * 1. If data is cached, return it immediately
 * 2. If a request is already in-flight for this month, return the existing promise
 * 3. Otherwise, start a new fetch, cache the result, and clean up tracking
 */
export async function fetchAndCache(pageType: PageType, month: string): Promise<unknown> {
  const key = `${pageType}-${month}`;

  // 1. Check cache first
  const cached = useMonthStore.getState().getCachedData(pageType, month);
  if (cached) {
    return cached;
  }

  // 2. Return in-flight request if already fetching
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key)!;
  }

  // 3. Start new fetch
  const promise = (async () => {
    try {
      let result: unknown;

      switch (pageType) {
        case 'dashboard':
          result = await getDashboardData(month);
          break;
        case 'expenses':
          result = await getExpenses({ yearMonth: month });
          break;
        case 'income':
          result = await getIncome({ yearMonth: month });
          break;
        case 'budgets':
          result = await getBudgetsWithSpending(month);
          break;
        case 'faturas':
          result = await getFaturasByMonth(month);
          break;
        default:
          throw new Error(`Unknown page type: ${pageType}`);
      }

      // Store in cache (cast to any to bypass strict type checking)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useMonthStore.getState().setCachedData(pageType, month, result as any);

      return result;
    } finally {
      // Clean up in-flight tracking
      inFlightRequests.delete(key);
    }
  })();

  // Track the promise
  inFlightRequests.set(key, promise);

  return promise;
}

/**
 * Check if data is available in cache (no fetch needed)
 */
export function isDataAvailable(pageType: PageType, month: string): boolean {
  return useMonthStore.getState().getCachedData(pageType, month) !== null;
}
