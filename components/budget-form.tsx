'use client';

import { useState } from 'react';
import { upsertBudget, upsertMonthlyBudget } from '@/lib/actions/budgets';
import { displayToCents, centsToDisplay } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { CategoryIcon } from '@/components/icon-picker';

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
  const [values, setValues] = useState<Record<number, string>>(
    Object.fromEntries(
      budgets.map((b) => [
        b.categoryId,
        b.budgetAmount ? centsToDisplay(b.budgetAmount) : '',
      ])
    )
  );
  const [totalBudget, setTotalBudget] = useState<string>(
    monthlyBudget ? centsToDisplay(monthlyBudget) : ''
  );
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [totalBudgetError, setTotalBudgetError] = useState<string>('');

  async function handleBlur(categoryId: number, value: string) {
    if (value && !isNaN(parseFloat(value))) {
      try {
        const cents = displayToCents(value);
        await upsertBudget(categoryId, yearMonth, cents);
        setErrors((prev) => {
          const next = { ...prev };
          delete next[categoryId];
          return next;
        });
      } catch (error) {
        setErrors((prev) => ({ ...prev, [categoryId]: 'Failed to save' }));
        console.error('Budget save error:', error);
      }
    }
  }

  function handleChange(categoryId: number, value: string) {
    setValues((prev) => ({ ...prev, [categoryId]: value }));
    if (errors[categoryId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
    }
  }

  async function handleTotalBudgetBlur(value: string) {
    if (value && !isNaN(parseFloat(value))) {
      try {
        const cents = displayToCents(value);
        await upsertMonthlyBudget(yearMonth, cents);
        setTotalBudgetError('');
      } catch (error) {
        setTotalBudgetError('Failed to save');
        console.error('Monthly budget save error:', error);
      }
    }
  }

  function handleTotalBudgetChange(value: string) {
    setTotalBudget(value);
    if (totalBudgetError) {
      setTotalBudgetError('');
    }
  }

  // Calculate allocated amount in real-time
  const allocatedAmount = Object.values(values)
    .filter((v) => v && !isNaN(parseFloat(v)))
    .reduce((sum, v) => sum + displayToCents(v), 0);

  const totalBudgetCents =
    totalBudget && !isNaN(parseFloat(totalBudget)) ? displayToCents(totalBudget) : 0;

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
          <span className="text-lg font-semibold">Total Monthly Budget</span>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500">R$</span>
              <Input
                type="number"
                step="0.01"
                value={totalBudget}
                onChange={(e) => handleTotalBudgetChange(e.target.value)}
                onBlur={(e) => handleTotalBudgetBlur(e.target.value)}
                placeholder="0.00"
                className="w-32 text-right"
              />
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
                {remainingBudget >= 0 ? (
                  <>
                    R${centsToDisplay(remainingBudget)} left from R$
                    {centsToDisplay(totalBudgetCents)} budget
                  </>
                ) : (
                  <>
                    R${centsToDisplay(Math.abs(remainingBudget))} over your R$
                    {centsToDisplay(totalBudgetCents)} budget
                  </>
                )}
              </span>
              <span className={getTextColor()}>
                {allocationPercentage.toFixed(1)}% allocated
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
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
        <Card
          key={budget.categoryId}
          className="flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: budget.categoryColor }}
            >
              <CategoryIcon icon={budget.categoryIcon} />
            </div>
            <span className="font-medium">{budget.categoryName}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500">R$</span>
              <Input
                type="number"
                step="0.01"
                value={values[budget.categoryId] || ''}
                onChange={(e) => handleChange(budget.categoryId, e.target.value)}
                onBlur={(e) => handleBlur(budget.categoryId, e.target.value)}
                placeholder="0.00"
                className="w-32 text-right"
              />
            </div>
            {errors[budget.categoryId] && (
              <span className="text-xs text-red-600">{errors[budget.categoryId]}</span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
