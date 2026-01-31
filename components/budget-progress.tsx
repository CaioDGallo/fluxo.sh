'use client';
'use client';

import { useId } from 'react';
import { useLocale, useTranslations } from 'next-intl';
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
  const locale = useLocale();
  const id = useId();
  const netSpent = spent - replenished;
  const remaining = budget - netSpent;
  const percentage = budget > 0 ? (netSpent / budget) * 100 : 0;
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);
  const percentFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const percentLabel = `${percentFormatter.format(percentage)}%`;
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

  const badgeText = isOverBudget
    ? t('overBudgetLabel')
    : isWarning
      ? t('nearLimit')
      : null;

  const badgeColor = isOverBudget
    ? 'bg-red-100 text-red-700'
    : 'bg-yellow-100 text-yellow-700';

  const remainingId = `${id}-remaining`;
  const spentId = `${id}-spent`;

  return (
    <Card data-slot="budget-progress" className='px-4'>
      <CardContent className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 py-2 md:py-4 px-0 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: categoryColor }}
            aria-hidden="true"
          >
            <CategoryIcon icon={categoryIcon} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-medium text-sm truncate">{categoryName}</h3>
              {badgeText && (
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeColor}`}>
                  {badgeText}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end gap-0.5 shrink-0 md:ml-auto">
          <div
            id={remainingId}
            className={`text-sm font-medium ${textColor} tabular-nums whitespace-nowrap`}
          >
            {t('remaining')}: {formatCurrency(remaining)}
          </div>
          <div
            id={spentId}
            className="text-xs text-muted-foreground tabular-nums whitespace-nowrap"
          >
            {t('spent')}: {formatCurrency(netSpent)} / {formatCurrency(budget)}
          </div>
          {replenished > 0 && (
            <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              {t('replenished')}: -{formatCurrency(replenished)}
            </div>
          )}
        </div>
      </CardContent>

      {/* Progress bar - outside CardContent */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          role="progressbar"
          aria-valuenow={Math.round(clampedPercentage)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-labelledby={`${remainingId} ${spentId}`}
          aria-valuetext={percentLabel}
          data-slot="progress-bar"
          className={`h-full transition-[width] duration-300 motion-reduce:transition-none ${barColor}`}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </Card>
  );
}
