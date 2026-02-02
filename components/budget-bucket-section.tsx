'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CategoryBudgetRow } from '@/components/category-budget-row';
import { centsToDisplay } from '@/lib/utils';
import { BUCKET_CONFIG } from '@/lib/budget-503020-config';
import type { BucketType } from '@/lib/actions/budget-503020';
import type { BudgetRow } from '@/lib/budget-utils';

type BudgetBucketSectionProps = {
  bucket: BucketType;
  categories: BudgetRow[];
  allocatedAmount: number; // cents
  targetAmount: number; // cents
  targetPercentage: number; // 0-100
  values: Record<number, number>; // categoryId -> current value in form
  errors: Record<number, string>;
  savingIds: Set<number>;
  onBudgetChange: (categoryId: number, cents: number) => void;
  isSaving: boolean;
  defaultOpen?: boolean;
};

export function BudgetBucketSection({
  bucket,
  categories,
  allocatedAmount,
  targetAmount,
  targetPercentage,
  values,
  errors,
  savingIds,
  onBudgetChange,
  isSaving,
  defaultOpen = false,
}: BudgetBucketSectionProps) {
  const t = useTranslations('budgets');
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const config = BUCKET_CONFIG[bucket];
  const Icon = config.icon;

  // Calculate allocation percentage
  const allocationPercentage = targetAmount > 0 ? (allocatedAmount / targetAmount) * 100 : 0;

  // Determine progress bar color
  const getBarColor = () => {
    if (allocationPercentage > 100) return 'bg-red-500';
    if (allocationPercentage >= 80) return 'bg-yellow-500';
    return config.progressColor;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border bg-card">
        {/* Header */}
        <CollapsibleTrigger
          className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors touch-action-manipulation min-h-11"
          style={{ touchAction: 'manipulation' }}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Bucket icon */}
            <div className={`p-2 rounded-lg ${config.bgColor} shrink-0`}>
              <HugeiconsIcon icon={Icon} className={config.color} size={18} />
            </div>

            {/* Bucket label and count */}
            <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
              <span className="font-medium text-sm">{config.label}</span>
              {targetAmount > 0 && (
                <div className="flex items-center gap-2 w-full max-w-xs">
                  {/* Mini progress bar */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden flex-1 max-w-32">
                    <div
                      className={`h-full transition-[width] duration-300 ${getBarColor()}`}
                      style={{ width: `${Math.min(allocationPercentage, 100)}%` }}
                    />
                  </div>
                  {/* Percentage */}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.round(allocationPercentage)}%
                  </span>
                </div>
              )}
            </div>

            {/* Chevron */}
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={20}
              className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </CollapsibleTrigger>

        {/* Content */}
        <CollapsibleContent>
          <div className="px-4 pb-3 space-y-3">
            {/* Allocation summary */}
            {targetAmount > 0 && (
              <div className="text-xs text-muted-foreground pb-2 border-b">
                {t('bucketAllocated', {
                  amount: centsToDisplay(allocatedAmount),
                  total: centsToDisplay(targetAmount),
                })}
                {' · '}
                {t('targetPercentage', { percent: targetPercentage })}
              </div>
            )}

            {/* Category budget rows */}
            {categories.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                {t('noCategoriesInBucket')}
              </p>
            ) : (
              <div className="space-y-2">
                {categories.map((category) => (
                  <CategoryBudgetRow
                    key={category.categoryId}
                    categoryId={category.categoryId}
                    categoryName={category.categoryName}
                    categoryColor={category.categoryColor}
                    categoryIcon={category.categoryIcon}
                    value={values[category.categoryId] ?? 0}
                    onChange={(cents) => onBudgetChange(category.categoryId, cents)}
                    error={errors[category.categoryId]}
                    isSaving={savingIds.has(category.categoryId)}
                    disabled={isSaving}
                  />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
