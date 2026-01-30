'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { upsertBudget, upsertMonthlyBudget } from '@/lib/actions/budgets';
import { centsToDisplay } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Card, CardContent } from '@/components/ui/card';
import { CategoryIcon } from '@/components/icon-picker';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon } from '@hugeicons/core-free-icons';

type BudgetRow = {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  budgetAmount: number | null;
};

type BudgetFormProps = {
  yearMonth: string;
  budgets: BudgetRow[];
  monthlyBudget: number | null;
};

export function BudgetForm({ yearMonth, budgets, monthlyBudget }: BudgetFormProps) {
  const t = useTranslations('budgets');
  const tErrors = useTranslations('errors');
  const [values, setValues] = useState<Record<number, number>>(
    Object.fromEntries(
      budgets.map((b) => [
        b.categoryId,
        b.budgetAmount ?? 0,
      ])
    )
  );
  const [totalBudgetCents, setTotalBudgetCents] = useState<number>(
    monthlyBudget ?? 0
  );
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [totalBudgetError, setTotalBudgetError] = useState<string>('');
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [savingTotal, setSavingTotal] = useState<boolean>(false);

  async function handleBlur(categoryId: number, cents: number) {
    setSavingIds((prev) => new Set(prev).add(categoryId));
    try {
      await upsertBudget(categoryId, yearMonth, cents);
      setErrors((prev) => {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
    } catch (error) {
      setErrors((prev) => ({ ...prev, [categoryId]: tErrors('failedToSave') }));
      console.error('Budget save error:', error);
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(categoryId);
        return next;
      });
    }
  }

  function handleChange(categoryId: number, cents: number) {
    setValues((prev) => ({ ...prev, [categoryId]: cents }));
    if (errors[categoryId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
    }
  }

  async function handleTotalBudgetBlur(cents: number) {
    setSavingTotal(true);
    try {
      await upsertMonthlyBudget(yearMonth, cents);
      setTotalBudgetError('');
    } catch (error) {
      setTotalBudgetError(tErrors('failedToSave'));
      console.error('Monthly budget save error:', error);
    } finally {
      setSavingTotal(false);
    }
  }

  function handleTotalBudgetChange(cents: number) {
    setTotalBudgetCents(cents);
    if (totalBudgetError) {
      setTotalBudgetError('');
    }
  }

  // Calculate allocated amount in real-time
  const allocatedAmount = Object.values(values)
    .reduce((sum, v) => sum + v, 0);

  const remainingBudget = totalBudgetCents - allocatedAmount;
  const allocationPercentage = totalBudgetCents > 0 ? (allocatedAmount / totalBudgetCents) * 100 : 0;

  // Determine color based on allocation
  const getBarColor = () => {
    if (allocationPercentage > 100) return 'bg-red-500';
    if (allocationPercentage >= 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getTextColor = () => {
    if (allocationPercentage > 100) return 'text-red-700';
    if (allocationPercentage >= 80) return 'text-yellow-700';
    return 'text-green-700';
  };

  return (
    <div className="space-y-4">
      {/* Total Monthly Budget Input */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">{t('totalMonthlyBudget')}</span>
          <div className="flex flex-col items-end gap-1">
            <div className="relative">
              <CurrencyInput
                aria-label={t('totalMonthlyBudget')}
                value={totalBudgetCents}
                onChange={handleTotalBudgetChange}
                onBlur={() => handleTotalBudgetBlur(totalBudgetCents)}
                placeholder="R$ 0,00"
                className="w-32 sm:w-40 text-right"
                disabled={savingTotal}
              />
              {savingTotal && (
                <span className="absolute right-10 top-1/2 -translate-y-1/2">
                  <HugeiconsIcon icon={Loading03Icon} className="size-3 animate-spin" aria-hidden="true" />
                </span>
              )}
            </div>
            {totalBudgetError && (
              <span className="text-xs text-red-600">{totalBudgetError}</span>
            )}
          </div>
        </div>
      </Card>

      {/* Allocation Progress Bar */}
      {totalBudgetCents > 0 && (
        <Card className="p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className={getTextColor()}>
                {remainingBudget >= 0
                  ? t('leftFromBudget', {
                      remaining: centsToDisplay(remainingBudget),
                      total: centsToDisplay(totalBudgetCents),
                    })
                  : t('overBudget', {
                      over: centsToDisplay(Math.abs(remainingBudget)),
                      total: centsToDisplay(totalBudgetCents),
                    })}
              </span>
              <span className={getTextColor()}>
                {t('percentAllocated', { percent: allocationPercentage.toFixed(1) })}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={Math.round(allocationPercentage)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={
                remainingBudget >= 0
                  ? t('leftFromBudget', {
                      remaining: centsToDisplay(remainingBudget),
                      total: centsToDisplay(totalBudgetCents),
                    })
                  : t('overBudget', {
                      over: centsToDisplay(Math.abs(remainingBudget)),
                      total: centsToDisplay(totalBudgetCents),
                    })
              }
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className={`h-full transition-all ${getBarColor()}`}
                style={{ width: `${Math.min(allocationPercentage, 100)}%` }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Category Budgets */}
      {budgets.map((budget) => (
        <Card key={budget.categoryId} className="py-0">
          <CardContent className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3">
            {/* Category icon */}
            <div
              className="size-10 shrink-0 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: budget.categoryColor }}
            >
              <CategoryIcon icon={budget.categoryIcon} />
            </div>

            {/* Category name */}
            <div className="flex-1 min-w-0">
              <span className="font-medium text-sm truncate block">{budget.categoryName}</span>
            </div>

            {/* Budget input */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="relative">
                <CurrencyInput
                  aria-label={budget.categoryName}
                  value={values[budget.categoryId] || 0}
                  onChange={(cents) => handleChange(budget.categoryId, cents)}
                  onBlur={() => handleBlur(budget.categoryId, values[budget.categoryId] || 0)}
                  placeholder="R$ 0,00"
                  className="w-32 sm:w-40 text-right"
                  disabled={savingIds.has(budget.categoryId)}
                />
                {savingIds.has(budget.categoryId) && (
                  <span className="absolute right-10 top-1/2 -translate-y-1/2">
                    <HugeiconsIcon icon={Loading03Icon} className="size-3 animate-spin" aria-hidden="true" />
                  </span>
                )}
              </div>
              {errors[budget.categoryId] && (
                <span className="text-xs text-red-600">{errors[budget.categoryId]}</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
