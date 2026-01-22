'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TransactionForm } from '@/components/transaction-form';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon } from '@hugeicons/core-free-icons';
import type { Account, Category } from '@/lib/schema';
import type { RecentAccount } from '@/lib/actions/accounts';
import type { RecentCategory } from '@/lib/actions/categories';

type AddExpenseButtonProps = {
  accounts: Account[];
  categories: Category[];
  recentAccounts: RecentAccount[];
  recentCategories: RecentCategory[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function AddExpenseButton({
  accounts,
  categories,
  recentAccounts,
  recentCategories,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: AddExpenseButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const t = useTranslations('expenses');

  // Controlled/uncontrolled pattern
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen;

  return (
    <TransactionForm
      mode="expense"
      accounts={accounts}
      recentAccounts={recentAccounts}
      categories={categories}
      recentCategories={recentCategories}
      open={open}
      onOpenChange={setOpen}
      onSuccess={() => setOpen(false)}
      trigger={
        <Button variant="hollow" size="sm">
          <HugeiconsIcon icon={Add01Icon} className="mr-2 size-4" />
          {t('expense')}
        </Button>
      }
    />
  );
}
