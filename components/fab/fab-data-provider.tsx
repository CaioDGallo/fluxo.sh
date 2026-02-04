'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { getAccounts, getRecentAccounts, type RecentAccount } from '@/lib/actions/accounts';
import { getCategories, getRecentCategories, type RecentCategory } from '@/lib/actions/categories';
import type { Account, Category } from '@/lib/schema';

type FABData = {
  accounts: Account[];
  recentAccounts: RecentAccount[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  recentExpenseCategories: RecentCategory[];
  recentIncomeCategories: RecentCategory[];
};

type FABDataContextValue = {
  data: FABData | null;
  isLoading: boolean;
  fetchData: (force?: boolean) => Promise<void>;
};

const FABDataContext = createContext<FABDataContextValue | undefined>(undefined);

export function FABDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FABData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async (force = false) => {
    if (data && !force) return;

    setIsLoading(true);
    try {
      const [
        accounts,
        recentAccounts,
        allCategories,
        recentExpenseCategories,
        recentIncomeCategories,
      ] = await Promise.all([
        getAccounts(),
        getRecentAccounts(),
        getCategories(),
        getRecentCategories('expense'),
        getRecentCategories('income'),
      ]);

      const expenseCategories = allCategories.filter((c) => c.type === 'expense');
      const incomeCategories = allCategories.filter((c) => c.type === 'income');

      setData({
        accounts,
        recentAccounts,
        expenseCategories,
        incomeCategories,
        recentExpenseCategories,
        recentIncomeCategories,
      });
    } finally {
      setIsLoading(false);
    }
  }, [data]);

  return (
    <FABDataContext.Provider value={{ data, isLoading, fetchData }}>
      {children}
    </FABDataContext.Provider>
  );
}

export function useFABData() {
  const context = useContext(FABDataContext);
  if (!context) {
    throw new Error('useFABData must be used within FABDataProvider');
  }
  return context;
}
