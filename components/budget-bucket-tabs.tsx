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
      className="mb-6 grid grid-cols-2 gap-2"
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
              'flex items-center justify-center gap-2 rounded-none border-2 border-black p-3 text-sm font-bold',
              'transition-all min-h-[44px]',
              'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]',
              'hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none',
              'active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              isActive
                ? config
                  ? `${config.bgColor} ${config.color}`
                  : 'bg-blue-500 text-white dark:bg-blue-600'
                : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:border-white'
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
