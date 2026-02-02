'use client';

import { Card, CardContent } from '@/components/ui/card';
import { centsToDisplay } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon, AlertCircleIcon } from '@hugeicons/core-free-icons';
import type { BucketData } from '@/lib/actions/budget-503020';
import { BUCKET_CONFIG } from '@/lib/budget-503020-config';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface BucketCardProps {
  bucket: BucketData;
}

export function BucketCard({ bucket }: BucketCardProps) {
  const t = useTranslations('budget503020.buckets');
  const config = BUCKET_CONFIG[bucket.bucket];
  const Icon = config.icon;
  const searchParams = useSearchParams();
  const currentMonth = searchParams.get('month');

  // Status indicator
  const isOverBudget = bucket.percentage > 100;
  const isNearLimit = bucket.percentage >= 90 && bucket.percentage <= 100;

  let StatusIcon = Tick02Icon;
  let statusColor = 'text-green-600 dark:text-green-400';
  let statusLabel = 'No meta';

  if (isOverBudget) {
    StatusIcon = AlertCircleIcon;
    statusColor = 'text-red-600 dark:text-red-400';
    statusLabel = 'Acima do orçamento';
  } else if (isNearLimit) {
    StatusIcon = AlertCircleIcon;
    statusColor = 'text-orange-600 dark:text-orange-400';
    statusLabel = 'Próximo do limite';
  }

  // Build URL with bucket filter and preserve month if present
  const href = `/budgets?bucket=${bucket.bucket}${currentMonth ? `&month=${currentMonth}` : ''}`;

  return (
    <Link
      href={href}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-none"
    >
      <Card className="transition-shadow hover:shadow-md motion-reduce:transition-none">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-none`}>
                  <HugeiconsIcon icon={Icon} className={config.color} size={20} />
                </div>
                <span className="font-medium text-sm">{t(bucket.bucket)}</span>
              </div>
              <HugeiconsIcon
                icon={StatusIcon}
                className={statusColor}
                size={24}
                aria-label={statusLabel}
              />
            </div>

            {/* Progress */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-2xl font-bold tabular-nums">
                  {bucket.percentage}%
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">
                  R$&nbsp;{centsToDisplay(bucket.spent)} / {centsToDisplay(bucket.target)}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  role="progressbar"
                  aria-valuenow={Math.round(Math.min(bucket.percentage, 100))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${t(bucket.bucket)}: ${bucket.percentage}%`}
                  className={`h-full ${config.progressColor} transition-[width] duration-300 motion-reduce:transition-none`}
                  style={{ width: `${Math.min(bucket.percentage, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
