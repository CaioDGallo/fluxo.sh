'use client';

import { usePathname } from 'next/navigation';
import { ExpenseForm } from '@/components/expense-form';
import { IncomeForm } from '@/components/income-form';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon } from '@hugeicons/core-free-icons';
import type { Account, Category } from '@/lib/schema';

type FABProps = {
  accounts: Account[];
  expenseCategories: Category[];
  incomeCategories: Category[];
};

export function FAB({ accounts, expenseCategories, incomeCategories }: FABProps) {
  const pathname = usePathname();
  const isIncomePage = pathname === '/income';

  const FormComponent = isIncomePage ? IncomeForm : ExpenseForm;
  const categories = isIncomePage ? incomeCategories : expenseCategories;
  const label = isIncomePage ? 'Add income' : 'Add expense';

  return (
    <FormComponent
      accounts={accounts}
      categories={categories}
      trigger={
        <Button
          size="lg"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 shadow-lg"
          aria-label={label}
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-6" />
        </Button>
      }
    />
  );
}
