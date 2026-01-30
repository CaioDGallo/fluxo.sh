'use client';

import { useTranslations } from 'next-intl';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { CategoryIcon } from '@/components/icon-picker';

type BudgetProgressProps = {
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  spent: number; // cents
  replenished: number; // cents
  budget: number; // cents
};

export function BudgetProgress({
  categoryName,
  categoryColor,
  categoryIcon,
  spent,
  replenished,
  budget,
}: BudgetProgressProps) {
  const t = useTranslations('budgets');
  const netSpent = spent - replenished;
  const percentage = budget > 0 ? (netSpent / budget) * 100 : 0;
  const isOverBudget = percentage > 100;
  const isWarning = percentage >= 80 && percentage <= 100;

  const barColor = isOverBudget
    ? 'bg-red-600'
    : isWarning
      ? 'bg-yellow-600'
      : 'bg-green-600';

  const textColor = isOverBudget
    ? 'text-red-700'
    : isWarning
      ? 'text-yellow-700'
      : 'text-green-700';

  return (
    <Card data-slot="budget-progress">
      <CardContent className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-3 md:p-4">
        {/* Section 1: Icon + Category Name (top on mobile, left on desktop) */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: categoryColor }}
            aria-hidden="true"
          >
            <CategoryIcon icon={categoryIcon} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{categoryName}</h3>
            {/* Mobile only: simplified summary */}
            <p className="text-xs text-gray-500 md:hidden">
              {percentage.toFixed(0)}% • {formatCurrency(netSpent)} de {formatCurrency(budget)}
            </p>
          </div>
        </div>

        {/* Section 2: Budget Details (bottom on mobile, right on desktop) */}
        <div className="flex flex-col items-start md:items-end gap-0.5 shrink-0 md:ml-auto">
          {/* Main amounts - always visible */}
          <div className={`text-sm font-medium ${textColor}`}>
            {formatCurrency(netSpent)} / {formatCurrency(budget)}
          </div>

          {/* Replenishment - adaptive */}
          {replenished > 0 && (
            <>
              <div className="hidden md:block text-xs text-gray-500">
                {t('spent')}: {formatCurrency(spent)} • {t('replenished')}: -{formatCurrency(replenished)}
              </div>
              <div className="md:hidden text-xs text-gray-500">
                Reposto: -{formatCurrency(replenished)}
              </div>
            </>
          )}

          {/* Percentage - desktop only (shown in mobile summary above) */}
          <div className="hidden md:block text-xs text-gray-500">
            {percentage.toFixed(0)}%
          </div>
        </div>
      </CardContent>

      {/* Progress bar - outside CardContent */}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          role="progressbar"
          aria-valuenow={Math.min(percentage, 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${percentage.toFixed(0)}% de ${formatCurrency(budget)} usado`}
          data-slot="progress-bar"
          className={`h-full transition-[width] duration-300 motion-reduce:transition-none ${barColor}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </Card>
  );
}
