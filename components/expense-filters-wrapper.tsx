'use client';

import { useExpenseContext } from '@/lib/contexts/expense-context';
import { TransactionFilters } from '@/components/transaction-filters';
import type { Account, Category } from '@/lib/schema';

type ExpenseFiltersWrapperProps = {
  accounts: Account[];
  categories: Category[];
  currentMonth: string;
};

export function ExpenseFiltersWrapper({
  accounts,
  categories,
  currentMonth,
}: ExpenseFiltersWrapperProps) {
  const { setSearchQuery } = useExpenseContext();

  return (
    <TransactionFilters
      variant="expense"
      accounts={accounts}
      categories={categories}
      currentMonth={currentMonth}
      setSearchQuery={setSearchQuery}
    />
  );
}
