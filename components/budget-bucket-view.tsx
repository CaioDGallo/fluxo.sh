'use client';

import { BudgetProgress } from '@/components/budget-progress';
import { BUCKET_CONFIG } from '@/lib/budget-503020-config';
import { HugeiconsIcon } from '@hugeicons/react';
import { centsToDisplay } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import type { BudgetWithSpending } from '@/lib/actions/budgets';
import type { BucketFilter } from '@/lib/hooks/use-bucket-filter';
import { useState } from 'react';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

interface BudgetBucketViewProps {
  budgets: BudgetWithSpending[];
  bucketFilter: BucketFilter;
}

interface BucketSectionProps {
  bucket: 'necessities' | 'wants' | 'savings';
  budgets: BudgetWithSpending[];
  defaultExpanded?: boolean;
}

function BucketSection({ bucket, budgets, defaultExpanded = true }: BucketSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const t = useTranslations('budget503020.buckets');
  const config = BUCKET_CONFIG[bucket];
  const Icon = config.icon;

  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
  const totalBudget = budgets.reduce((sum, b) => sum + b.budget, 0);
  const percentage = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  if (budgets.length === 0) return null;

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full px-4 py-3 flex items-center justify-between',
          'hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset',
          config.bgColor
        )}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', config.bgColor)}>
            <HugeiconsIcon icon={Icon} className={config.color} size={20} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-sm">{t(bucket)}</h3>
            <p className="text-xs text-muted-foreground tabular-nums">
              R$&nbsp;{centsToDisplay(totalSpent)} de R$&nbsp;{centsToDisplay(totalBudget)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-[120px] hidden sm:block">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                role="progressbar"
                aria-valuenow={Math.round(Math.min(percentage, 100))}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${t(bucket)}: ${percentage}%`}
                className={cn(
                  'h-full transition-[width] duration-300 motion-reduce:transition-none',
                  config.progressColor
                )}
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
          </div>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={20}
            className={cn(
              'text-muted-foreground transition-transform duration-200',
              isExpanded ? 'rotate-180' : ''
            )}
          />
        </div>
      </button>

      {/* Budget Cards */}
      {isExpanded && (
        <div className="p-4 space-y-4 bg-background">
          {budgets.map((budget) => (
            <BudgetProgress
              key={budget.categoryId}
              categoryName={budget.categoryName}
              categoryColor={budget.categoryColor}
              categoryIcon={budget.categoryIcon}
              spent={budget.spent}
              replenished={budget.replenished}
              budget={budget.budget}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BudgetBucketView({ budgets, bucketFilter }: BudgetBucketViewProps) {
  const t = useTranslations('budgets');

  // Filter budgets based on selected bucket
  const filteredBudgets =
    bucketFilter === 'all'
      ? budgets
      : budgets.filter((b) => b.categoryBucket === bucketFilter);

  if (bucketFilter === 'all') {
    // Group by bucket
    const necessities = budgets.filter((b) => b.categoryBucket === 'necessities');
    const wants = budgets.filter((b) => b.categoryBucket === 'wants');
    const savings = budgets.filter((b) => b.categoryBucket === 'savings');
    const uncategorized = budgets.filter((b) => !b.categoryBucket);

    return (
      <div>
        <h2 className="mb-4 text-lg font-semibold text-balance">{t('budgetByCategory')}</h2>
        <div className="space-y-4">
          <BucketSection bucket="necessities" budgets={necessities} />
          <BucketSection bucket="wants" budgets={wants} />
          <BucketSection bucket="savings" budgets={savings} />

          {/* Uncategorized budgets (no bucket assigned) */}
          {uncategorized.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                Sem categoria de orçamento
              </h3>
              {uncategorized.map((budget) => (
                <BudgetProgress
                  key={budget.categoryId}
                  categoryName={budget.categoryName}
                  categoryColor={budget.categoryColor}
                  categoryIcon={budget.categoryIcon}
                  spent={budget.spent}
                  replenished={budget.replenished}
                  budget={budget.budget}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Single bucket view
  const config = BUCKET_CONFIG[bucketFilter];
  const totalSpent = filteredBudgets.reduce((sum, b) => sum + b.spent, 0);
  const totalBudget = filteredBudgets.reduce((sum, b) => sum + b.budget, 0);

  return (
    <div>
      {/* Bucket Summary */}
      <div className={cn('mb-6 p-4 rounded-lg', config.bgColor)}>
        <div className="flex items-center gap-3 mb-2">
          <HugeiconsIcon icon={config.icon} className={config.color} size={24} />
          <h2 className="text-lg font-semibold">{config.label}</h2>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          R$&nbsp;{centsToDisplay(totalSpent)} de R$&nbsp;{centsToDisplay(totalBudget)}
        </p>
      </div>

      {/* Budget List */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-balance">{t('budgetByCategory')}</h2>
        <div className="space-y-4">
          {filteredBudgets.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum orçamento nesta categoria
            </p>
          ) : (
            filteredBudgets.map((budget) => (
              <BudgetProgress
                key={budget.categoryId}
                categoryName={budget.categoryName}
                categoryColor={budget.categoryColor}
                categoryIcon={budget.categoryIcon}
                spent={budget.spent}
                replenished={budget.replenished}
                budget={budget.budget}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
