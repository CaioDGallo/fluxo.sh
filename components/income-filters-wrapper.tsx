'use client';

import { useIncomeContext } from '@/lib/contexts/income-context';
import { TransactionFilters } from '@/components/transaction-filters';
import type { Account, Category } from '@/lib/schema';

type IncomeFiltersWrapperProps = {
  accounts: Account[];
  categories: Category[];
  currentMonth: string;
};

export function IncomeFiltersWrapper({
  accounts,
  categories,
  currentMonth,
}: IncomeFiltersWrapperProps) {
  const { setSearchQuery } = useIncomeContext();

  return (
    <TransactionFilters
      variant="income"
      accounts={accounts}
      categories={categories}
      currentMonth={currentMonth}
      setSearchQuery={setSearchQuery}
    />
  );
}
