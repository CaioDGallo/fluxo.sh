'use client';

import { Card, CardContent } from '@/components/ui/card';
import { centsToDisplay } from '@/lib/utils';
import type { SafeToSpendData } from '@/lib/actions/budget-503020';
import { PACING_CONFIG } from '@/lib/budget-503020-config';
import { useTranslations } from 'next-intl';

interface SafeToSpendHeroProps {
  data: SafeToSpendData;
}

// Map snake_case status values to camelCase translation keys
const PACING_KEY_MAP = {
  on_track: 'onTrack',
  over_pace: 'overPace',
  under_pace: 'underPace',
} as const;

export function SafeToSpendHero({ data }: SafeToSpendHeroProps) {
  const t = useTranslations('budget503020');
  const tPacing = useTranslations('budget503020.pacing');
  const wantsBucket = data.buckets.find((b) => b.bucket === 'wants');
  const pacingConfig = PACING_CONFIG[data.pacing.status];
  const pacingKey = PACING_KEY_MAP[data.pacing.status];

  if (!wantsBucket) return null;

  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Hero number */}
          <div>
            <p className="text-sm text-gray-600 mb-1">{t('safeToSpend')}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-gray-900">
                R$ {centsToDisplay(data.wantsSafeToSpendDaily)}
              </span>
              <span className="text-lg text-gray-600">{t('perDay')}</span>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">R$ {centsToDisplay(data.wantsSafeToSpend)}</span>
              {' '}{t('remaining')}
            </div>
            <div>•</div>
            <div>
              {t('daysRemaining', { count: data.daysRemaining })}
            </div>
          </div>

          {/* Pacing indicator */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${pacingConfig.bgColor}`}>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${pacingConfig.color}`}>
                  {tPacing(pacingKey)}
                </span>
                <span className="text-xs text-gray-600">
                  {data.pacing.percentageOfExpected}%
                </span>
              </div>
              <div className="h-2 bg-white rounded-full overflow-hidden">
                <div
                  className={`h-full ${pacingConfig.barColor} transition-all`}
                  style={{ width: `${Math.min(data.pacing.percentageOfExpected, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
