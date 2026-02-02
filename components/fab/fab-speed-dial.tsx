'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  ArrowUpBigIcon,
  ArrowDownBigIcon,
} from '@hugeicons/core-free-icons';
import { TransactionForm } from '@/components/transaction-form';
import { Button } from '@/components/ui/button';
import { useFABData } from './fab-data-provider';

export function FABSpeedDial() {
  const t = useTranslations('fab');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
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

  const handleOptionClick = (type: 'expense' | 'income') => {
    setIsExpanded(false);
    if (type === 'expense') {
      setShowExpenseForm(true);
    } else {
      setShowIncomeForm(true);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-30 bg-black/20 animate-in fade-in duration-200"
          onClick={() => setIsExpanded(false)}
          aria-hidden="true"
        />
      )}

      {/* FAB Container */}
      <div className="relative flex flex-col items-end gap-3 z-50">
        {/* Speed Dial Options */}
        {isExpanded && (
          <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
            {/* Income Button */}
            <div className="flex items-center gap-3 group">
              <span className="bg-background/95 backdrop-blur-sm border border-border rounded-none px-3 py-1.5 text-sm font-medium shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                {t('income')}
              </span>
              <Button
                type="button"
                variant="hollow"
                size="icon-lg"
                onClick={() => handleOptionClick('income')}
                disabled={isLoading}
                aria-label={t('income')}
                className={cn(
                  'rounded-none bg-green-500 text-white hover:bg-green-600 border-2 border-black',
                  isLoading && 'opacity-50 pointer-events-none'
                )}
              >
                <HugeiconsIcon icon={ArrowUpBigIcon} strokeWidth={2.5} className="size-6" />
              </Button>
            </div>

            {/* Expense Button */}
            <div className="flex items-center gap-3 group">
              <span className="bg-background/95 backdrop-blur-sm border border-border rounded-none px-3 py-1.5 text-sm font-medium shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                {t('expense')}
              </span>
              <Button
                type="button"
                variant="hollow"
                size="icon-lg"
                onClick={() => handleOptionClick('expense')}
                disabled={isLoading}
                aria-label={t('expense')}
                className={cn(
                  'rounded-none bg-red-500 text-white hover:bg-red-600 border-2 border-black',
                  isLoading && 'opacity-50 pointer-events-none'
                )}
              >
                <HugeiconsIcon icon={ArrowDownBigIcon} strokeWidth={2.5} className="size-6" />
              </Button>
            </div>
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
            isExpanded && 'rotate-45'
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
    </>
  );
}
