'use client';

import { useBucketFilter, type BucketFilter } from '@/lib/hooks/use-bucket-filter';
import { BUCKET_CONFIG } from '@/lib/budget-503020-config';
import { HugeiconsIcon } from '@hugeicons/react';
import { ViewIcon } from '@hugeicons/core-free-icons';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const BUCKET_OPTIONS: { value: BucketFilter; iconKey?: keyof typeof BUCKET_CONFIG }[] = [
  { value: 'all' },
  { value: 'necessities', iconKey: 'necessities' },
  { value: 'wants', iconKey: 'wants' },
  { value: 'savings', iconKey: 'savings' },
];

export function BudgetBucketTabs() {
  const { currentBucket, setBucket } = useBucketFilter();
  const t = useTranslations('budgets');
  const tBuckets = useTranslations('budget503020.buckets');

  return (
    <div
      role="tablist"
      aria-label={t('filterByBucket')}
      className="mb-6 -mx-4 px-4 overflow-x-auto snap-x snap-mandatory flex gap-2 md:justify-center scrollbar-hide"
    >
      {BUCKET_OPTIONS.map(({ value, iconKey }) => {
        const isActive = currentBucket === value;
        const config = iconKey ? BUCKET_CONFIG[iconKey] : null;
        const Icon = iconKey ? config!.icon : ViewIcon;

        return (
          <button
            key={value}
            role="tab"
            aria-selected={isActive}
            aria-controls={`bucket-panel-${value}`}
            onClick={() => setBucket(value)}
            className={cn(
              'snap-start shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium',
              'transition-colors duration-200 motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'min-h-[44px]', // Touch target
              isActive
                ? config
                  ? `${config.bgColor} ${config.color}`
                  : 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            )}
          >
            <HugeiconsIcon icon={Icon} size={18} aria-hidden="true" />
            <span>{value === 'all' ? t('allBuckets') : tBuckets(value)}</span>
          </button>
        );
      })}
    </div>
  );
}
