'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  MoneySend02Icon,
  MoneyReceive02Icon,
  Wallet01Icon,
} from '@hugeicons/core-free-icons';
import { TransactionForm } from '@/components/transaction-form';
import { AccountCreateFlow } from '@/components/account-create-flow';
import { Button } from '@/components/ui/button';
import { useFABData } from './fab-data-provider';

export function FABSpeedDial() {
  const t = useTranslations('fab');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showAccountFlow, setShowAccountFlow] = useState(false);
  const { data, isLoading, fetchData } = useFABData();

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isExpanded]);

  const handleFABClick = async () => {
    if (!isExpanded) {
      // Fetch data on first expand
      await fetchData();
    }
    setIsExpanded(!isExpanded);
  };

  const handleOptionClick = (type: 'expense' | 'income' | 'account') => {
    setIsExpanded(false);
    if (type === 'expense') {
      setShowExpenseForm(true);
    } else if (type === 'income') {
      setShowIncomeForm(true);
    } else {
      setShowAccountFlow(true);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-30 animate-in fade-in duration-200"
          onClick={() => setIsExpanded(false)}
          aria-hidden="true"
        />
      )}

      {/* FAB Container */}
      <div className="relative flex flex-col items-end gap-3 z-50">
        {/* Speed Dial Options */}
        {isExpanded && (
          <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <Button
              type="button"
              variant="popout"
              size="lg"
              onClick={() => handleOptionClick('account')}
              aria-label={t('account')}
              className="h-12 rounded-none bg-blue-600/70 text-white hover:bg-blue-600 border-2 border-black gap-3 px-4"
            >
              <HugeiconsIcon icon={Wallet01Icon} strokeWidth={2.5} className="size-5" />
              <span className="text-sm font-semibold">{t('account')}</span>
            </Button>

            <Button
              type="button"
              variant="popout"
              size="lg"
              onClick={() => handleOptionClick('income')}
              disabled={isLoading}
              aria-label={t('income')}
              className={cn(
                'h-12 rounded-none bg-green-600/70 text-white hover:bg-green-600 border-2 border-black gap-3 px-4',
                isLoading && 'opacity-50 pointer-events-none'
              )}
            >
              <HugeiconsIcon icon={MoneyReceive02Icon} strokeWidth={2.5} className="size-5" />
              <span className="text-sm font-semibold">{t('income')}</span>
            </Button>

            <Button
              type="button"
              variant="popout"
              size="lg"
              onClick={() => handleOptionClick('expense')}
              disabled={isLoading}
              aria-label={t('expense')}
              className={cn(
                'h-12 rounded-none bg-red-600/70 text-white hover:bg-red-600 border-2 border-black gap-3 px-4',
                isLoading && 'opacity-50 pointer-events-none'
              )}
            >
              <HugeiconsIcon icon={MoneySend02Icon} strokeWidth={2.5} className="size-5" />
              <span className="text-sm font-semibold">{t('expense')}</span>
            </Button>
          </div>
        )}

        {/* Main FAB Button */}
        <Button
          type="button"
          variant="popout"
          size="icon-lg"
          onClick={handleFABClick}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? t('close') : t('addTransaction')}
          className={cn(
            'rounded-none size-14 transition-transform duration-200',
            isExpanded && '-rotate-5'
          )}
        >
          <HugeiconsIcon
            icon={Add01Icon}
            strokeWidth={2.5}
            className="size-7"
          />
        </Button>
      </div>

      {/* Transaction Forms */}
      {data && (
        <>
          <TransactionForm
            mode="expense"
            accounts={data.accounts}
            recentAccounts={data.recentAccounts}
            categories={data.expenseCategories}
            recentCategories={data.recentExpenseCategories}
            open={showExpenseForm}
            onOpenChange={setShowExpenseForm}
          />
          <TransactionForm
            mode="income"
            accounts={data.accounts}
            recentAccounts={data.recentAccounts}
            categories={data.incomeCategories}
            recentCategories={data.recentIncomeCategories}
            open={showIncomeForm}
            onOpenChange={setShowIncomeForm}
          />
        </>
      )}

      <AccountCreateFlow
        open={showAccountFlow}
        onOpenChange={setShowAccountFlow}
        onSuccess={() => {
          void fetchData(true);
        }}
      />
    </>
  );
}
