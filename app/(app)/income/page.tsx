'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { type IncomeFilters as IncomeFiltersType } from '@/lib/actions/income';
import { getAccounts } from '@/lib/actions/accounts';
import { getCategories } from '@/lib/actions/categories';
import { IncomeList, IncomeListProvider } from '@/components/income-list';
import { IncomeFiltersWrapper } from '@/components/income-filters-wrapper';
import { IncomeFilterSummary } from '@/components/income-filter-summary';
import { ImportModal } from '@/components/import/import-modal';
import { AddIncomeButton } from '@/components/add-income-button';
import { useMonthStore } from '@/lib/stores/month-store';
import { useIncomeData } from '@/lib/hooks/use-income-data';
import { usePrefetchMonths } from '@/lib/hooks/use-prefetch-months';
import type { Account, Category } from '@/lib/schema';

export default function IncomePage() {
  const t = useTranslations('income');
  const currentMonth = useMonthStore((state) => state.currentMonth);

  // Local filter state
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Build filters object
  const filters: IncomeFiltersType = {
    yearMonth: currentMonth,
    categoryId: categoryFilter !== 'all' ? parseInt(categoryFilter) : undefined,
    accountId: accountFilter !== 'all' ? parseInt(accountFilter) : undefined,
    status: (statusFilter as 'all' | 'received' | 'pending') || 'all',
  };

  // Fetch data
  const { data: income, loading: incomeLoading } = useIncomeData(filters);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Prefetch adjacent months
  usePrefetchMonths('income');

  // Fetch accounts, categories on mount (these don't change by month)
  useEffect(() => {
    Promise.all([
      getAccounts(),
      getCategories('income'),
    ]).then(([accts, cats]) => {
      setAccounts(accts);
      setCategories(cats);
      setLoadingMeta(false);
    });
  }, []);

  if (incomeLoading || loadingMeta || !income) {
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
          <AddIncomeButton accounts={accounts} categories={categories} />
        </div>
      </div>

      <IncomeListProvider
        initialIncome={income}
        accounts={accounts}
        categories={categories}
        filters={filters}
      >
        <IncomeFiltersWrapper
          accounts={accounts}
          categories={categories}
          categoryFilter={categoryFilter}
          accountFilter={accountFilter}
          statusFilter={statusFilter}
          onCategoryChange={setCategoryFilter}
          onAccountChange={setAccountFilter}
          onStatusChange={setStatusFilter}
        />
        <IncomeFilterSummary />
        <IncomeList />
      </IncomeListProvider>
    </div>
  );
}
