'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { upsertBudget, upsertMonthlyBudget } from '@/lib/actions/budgets';
import { centsToDisplay } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Card, CardContent } from '@/components/ui/card';
import { CategoryIcon } from '@/components/icon-picker';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

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
  const tCommon = useTranslations('common');

  const baseBudgetMap = useMemo(
    () => new Map(budgets.map((budget) => [budget.categoryId, budget.budgetAmount ?? 0])),
    [budgets]
  );

  const [edits, setEdits] = useState<Record<number, number>>({});
  const [totalBudgetEdit, setTotalBudgetEdit] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [totalBudgetError, setTotalBudgetError] = useState<string>('');
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [savingTotal, setSavingTotal] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<'idle' | 'saved'>('idle');
  const [query, setQuery] = useState('');
  const [hideZero, setHideZero] = useState(false);

  const values = useMemo(
    () => Object.fromEntries(
      budgets.map((budget) => [budget.categoryId, edits[budget.categoryId] ?? budget.budgetAmount ?? 0])
    ),
    [budgets, edits]
  );

  const totalBudgetCents = totalBudgetEdit ?? (monthlyBudget ?? 0);

  function handleChange(categoryId: number, cents: number) {
    const baseAmount = baseBudgetMap.get(categoryId) ?? 0;

    setEdits((prev) => {
      if (cents === baseAmount) {
        if (!(categoryId in prev)) return prev;
        const next = { ...prev };
        delete next[categoryId];
        return next;
      }

      if (prev[categoryId] === cents) return prev;

      return { ...prev, [categoryId]: cents };
    });
    if (errors[categoryId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
    }
    if (saveFeedback !== 'idle') {
      setSaveFeedback('idle');
    }
  }

  function handleTotalBudgetChange(cents: number) {
    const baseTotal = monthlyBudget ?? 0;
    setTotalBudgetEdit(cents === baseTotal ? null : cents);
    if (totalBudgetError) {
      setTotalBudgetError('');
    }
    if (saveFeedback !== 'idle') {
      setSaveFeedback('idle');
    }
  }

  const isSaving = savingTotal || savingIds.size > 0;
  const hasEdits = budgets.some((budget) => edits[budget.categoryId] !== undefined);
  const isDirty = totalBudgetEdit !== null || hasEdits;

  const filteredBudgets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return budgets.filter((budget) => {
      const amount = values[budget.categoryId] ?? 0;

      if (hideZero && amount === 0) return false;
      if (normalizedQuery && !budget.categoryName.toLowerCase().includes(normalizedQuery)) {
        return false;
      }

      return true;
    });
  }, [budgets, hideZero, query, values]);

  async function handleSave() {
    if (isSaving || !isDirty) return;

    setSaveFeedback('idle');
    setTotalBudgetError('');

    const changedBudgets = budgets.filter((budget) => edits[budget.categoryId] !== undefined);
    const monthlyChanged = totalBudgetEdit !== null;
    const nextErrors = { ...errors };
    const savingSet = new Set(changedBudgets.map((budget) => budget.categoryId));
    const successfulBudgetIds = new Set<number>();

    changedBudgets.forEach((budget) => {
      delete nextErrors[budget.categoryId];
    });

    setSavingIds(savingSet);
    setSavingTotal(monthlyChanged);

    await Promise.all(
      changedBudgets.map(async (budget) => {
        try {
          await upsertBudget(budget.categoryId, yearMonth, edits[budget.categoryId] ?? 0);
          successfulBudgetIds.add(budget.categoryId);
        } catch (error) {
          nextErrors[budget.categoryId] = tErrors('failedToSave');
          console.error('Budget save error:', error);
        }
      })
    );

    let nextTotalError = '';
    let monthlySuccess = false;

    if (monthlyChanged) {
      try {
        await upsertMonthlyBudget(yearMonth, totalBudgetCents);
        monthlySuccess = true;
      } catch (error) {
        nextTotalError = tErrors('failedToSave');
        console.error('Monthly budget save error:', error);
      }
    }

    if (successfulBudgetIds.size > 0) {
      setEdits((prev) => {
        const next = { ...prev };

        successfulBudgetIds.forEach((categoryId) => {
          delete next[categoryId];
        });

        return next;
      });
    }

    if (monthlySuccess) {
      setTotalBudgetEdit(null);
    }

    setErrors(nextErrors);
    setTotalBudgetError(nextTotalError);
    setSavingIds(new Set());
    setSavingTotal(false);

    const hasErrors = Object.keys(nextErrors).length > 0 || nextTotalError;
    if (!hasErrors) {
      setSaveFeedback('saved');
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

  const statusMessage = isSaving
    ? tCommon('saving')
    : isDirty
      ? t('unsavedChanges')
      : saveFeedback === 'saved'
        ? t('saved')
        : '';

  const statusTone = isSaving
    ? 'text-muted-foreground'
    : isDirty
      ? 'text-yellow-700'
      : saveFeedback === 'saved'
        ? 'text-green-700'
        : 'text-muted-foreground';

  return (
    <div className="space-y-4">
      {/* Monthly Budget Summary */}
      <Card className="py-0">
        <CardContent className="space-y-3 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 md:space-y-0 flex flex-col md:flex-row">
              <span className="text-sm font-semibold">{t('totalMonthlyBudget')}</span>
              {statusMessage && (
                <span className={`ml-0 md:ml-4 text-xs content-center ${statusTone}`} role="status" aria-live="polite">
                  {statusMessage}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <CurrencyInput
                  aria-label={t('totalMonthlyBudget')}
                  name="monthly-budget"
                  value={totalBudgetCents}
                  onChange={handleTotalBudgetChange}
                  className="w-32 sm:w-40 text-right tabular-nums"
                  disabled={isSaving}
                />
                {savingTotal && (
                  <span className="absolute right-10 top-1/2 -translate-y-1/2">
                    <HugeiconsIcon icon={Loading03Icon} className="size-3 animate-spin" aria-hidden="true" />
                  </span>
                )}
              </div>
              <Button onClick={handleSave} disabled={!isDirty || isSaving}>
                {isSaving ? tCommon('saving') : t('saveChanges')}
              </Button>
            </div>
          </div>
          {totalBudgetError && (
            <span className="text-xs text-red-600">{totalBudgetError}</span>
          )}
          {totalBudgetCents > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
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
                <span className={`${getTextColor()} tabular-nums`}>
                  {t('percentAllocated', { percent: allocationPercentage.toFixed(1) })}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={Math.min(Math.round(allocationPercentage), 100)}
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
                  className={`h-full transition-[width] duration-300 ease-out ${getBarColor()}`}
                  style={{ width: `${Math.min(allocationPercentage, 100)}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {budgets.length === 0 ? (
        <Card className="py-0">
          <CardContent className="space-y-3 px-4 py-4">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-balance">{t('noExpenseCategories')}</h2>
              <p className="text-xs text-muted-foreground">
                {t('noExpenseCategoriesDescription')}
              </p>
            </div>
            <Button asChild variant="hollow">
              <Link href="/settings/categories">{t('addExpenseCategory')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-xs">
              <Label htmlFor="budget-search" className="sr-only">
                {t('searchPlaceholder')}
              </Label>
              <Input
                id="budget-search"
                name="budget-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('searchPlaceholder')}
                autoComplete="off"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="hide-zero"
                checked={hideZero}
                onCheckedChange={(checked) => setHideZero(checked === true)}
              />
              <Label htmlFor="hide-zero">{t('hideZeroBudgets')}</Label>
            </div>
          </div>

          {/* Category Budgets */}
          {filteredBudgets.length === 0 ? (
            <div className="rounded-none border border-dashed p-6 text-center text-xs text-muted-foreground">
              {t('noResults')}
            </div>
          ) : (
            filteredBudgets.map((budget) => (
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
                        name={`budget-${budget.categoryId}`}
                        value={values[budget.categoryId] ?? 0}
                        onChange={(cents) => handleChange(budget.categoryId, cents)}
                        className="w-32 sm:w-40 text-right tabular-nums"
                        disabled={isSaving}
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
            ))
          )}
        </>
      )}
    </div>
  );
}
