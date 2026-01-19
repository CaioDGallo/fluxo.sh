'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { type ExpenseFilters as ExpenseFiltersType } from '@/lib/actions/expenses';
import { getAccounts } from '@/lib/actions/accounts';
import { getCategories } from '@/lib/actions/categories';
import { getUnpaidFaturas } from '@/lib/actions/faturas';
import { ExpenseList, ExpenseListProvider } from '@/components/expense-list';
import { ExpenseFiltersWrapper } from '@/components/expense-filters-wrapper';
import { ExpenseFilterSummary } from '@/components/expense-filter-summary';
import { ImportModal } from '@/components/import/import-modal';
import { AddExpenseButton } from '@/components/add-expense-button';
import { useMonthStore } from '@/lib/stores/month-store';
import { useExpensesData } from '@/lib/hooks/use-expenses-data';
import { usePrefetchMonths } from '@/lib/hooks/use-prefetch-months';
import type { Account, Category } from '@/lib/schema';
import type { UnpaidFatura } from '@/lib/actions/faturas';

export default function ExpensesPage() {
  const t = useTranslations('expenses');
  const currentMonth = useMonthStore((state) => state.currentMonth);

  // Local filter state
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Build filters object
  const filters: ExpenseFiltersType = {
    yearMonth: currentMonth,
    categoryId: categoryFilter !== 'all' ? parseInt(categoryFilter) : undefined,
    accountId: accountFilter !== 'all' ? parseInt(accountFilter) : undefined,
    status: (statusFilter as 'all' | 'paid' | 'pending') || 'all',
  };

  // Fetch data
  const { data: expenses, loading: expensesLoading } = useExpensesData(filters);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [unpaidFaturas, setUnpaidFaturas] = useState<UnpaidFatura[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Prefetch adjacent months
  usePrefetchMonths('expenses');

  // Fetch accounts, categories, unpaidFaturas on mount (these don't change by month)
  useEffect(() => {
    Promise.all([
      getAccounts(),
      getCategories('expense'),
      getUnpaidFaturas(),
    ]).then(([accts, cats, faturas]) => {
      setAccounts(accts);
      setCategories(cats);
      setUnpaidFaturas(faturas);
      setLoadingMeta(false);
    });
  }, []);

  if (expensesLoading || loadingMeta || !expenses) {
    return (
      <div>
        <div className="mb-6 flex items-center justify-between flex-col md:flex-row space-y-4 md:space-y-0">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
        </div>
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="text-lg">{t('loading', { default: 'Carregando...' })}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-col md:flex-row space-y-4 md:space-y-0">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="flex gap-2 w-full justify-end">
          <ImportModal accounts={accounts} categories={categories} />
          <AddExpenseButton accounts={accounts} categories={categories} />
        </div>
      </div>

      <ExpenseListProvider
        initialExpenses={expenses}
        accounts={accounts}
        categories={categories}
        filters={filters}
        unpaidFaturas={unpaidFaturas}
      >
        <ExpenseFiltersWrapper
          accounts={accounts}
          categories={categories}
          categoryFilter={categoryFilter}
          accountFilter={accountFilter}
          statusFilter={statusFilter}
          onCategoryChange={setCategoryFilter}
          onAccountChange={setAccountFilter}
          onStatusChange={setStatusFilter}
        />
        <ExpenseFilterSummary />
        <ExpenseList />
      </ExpenseListProvider>
    </div>
  );
}
