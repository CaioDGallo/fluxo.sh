'use client';

import { useState } from 'react';
import { TransactionForm } from '@/components/transaction-form';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Remove02Icon, ArrowUp01Icon } from '@hugeicons/core-free-icons';
import type { Account, Category } from '@/lib/schema';

type FABProps = {
  accounts: Account[];
  expenseCategories: Category[];
  incomeCategories: Category[];
};

export function FAB({ accounts, expenseCategories, incomeCategories }: FABProps) {
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            variant="popout"
            className="fixed bottom-6 right-6 z-50 h-14 w-14 cursor-pointer hover:bg-gray-400"
            aria-label="Add transaction"
          >
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" sideOffset={8}>
          <DropdownMenuItem onSelect={() => setExpenseOpen(true)}>
            <HugeiconsIcon icon={Remove02Icon} strokeWidth={2} />
            Add Expense
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setIncomeOpen(true)}>
            <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} />
            Add Income
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TransactionForm
        mode="expense"
        accounts={accounts}
        categories={expenseCategories}
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
      />

      <TransactionForm
        mode="income"
        accounts={accounts}
        categories={incomeCategories}
        open={incomeOpen}
        onOpenChange={setIncomeOpen}
      />
    </>
  );
}
