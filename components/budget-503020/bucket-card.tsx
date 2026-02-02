'use client';

import { Card, CardContent } from '@/components/ui/card';
import { centsToDisplay } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import type { BucketData } from '@/lib/actions/budget-503020';
import { BUCKET_CONFIG } from '@/lib/budget-503020-config';
import { useTranslations } from 'next-intl';

interface BucketCardProps {
  bucket: BucketData;
}

export function BucketCard({ bucket }: BucketCardProps) {
  const t = useTranslations('budget503020.buckets');
  const config = BUCKET_CONFIG[bucket.bucket];
  const Icon = config.icon;

  // Status indicator
  const isOverBudget = bucket.percentage > 100;
  const isNearLimit = bucket.percentage >= 90 && bucket.percentage <= 100;

  let statusIcon = '✓';
  let statusColor = 'text-green-600';

  if (isOverBudget) {
    statusIcon = '⚠';
    statusColor = 'text-red-600';
  } else if (isNearLimit) {
    statusIcon = '⚠';
    statusColor = 'text-orange-600';
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-lg ${config.bgColor}`}>
                <HugeiconsIcon icon={Icon} className={config.color} size={20} />
              </div>
              <span className="font-medium text-sm">{t(bucket.bucket)}</span>
            </div>
            <span className={`text-2xl ${statusColor}`}>{statusIcon}</span>
          </div>

          {/* Progress */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-2xl font-bold">
                {bucket.percentage}%
              </span>
              <span className="text-sm text-gray-600">
                R$ {centsToDisplay(bucket.spent)} / {centsToDisplay(bucket.target)}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${config.progressColor} transition-all`}
                style={{ width: `${Math.min(bucket.percentage, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
