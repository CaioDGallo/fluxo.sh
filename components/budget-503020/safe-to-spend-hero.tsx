'use client';

import { Card, CardContent } from '@/components/ui/card';
import { centsToDisplay } from '@/lib/utils';
import type { SafeToSpendData, PresetType } from '@/lib/actions/budget-503020';
import { PACING_CONFIG } from '@/lib/budget-503020-config';
import { useTranslations } from 'next-intl';
import { PresetSelector } from './preset-selector';

interface SafeToSpendHeroProps {
  data: SafeToSpendData;
  currentPreset: PresetType;
}

// Map snake_case status values to camelCase translation keys
const PACING_KEY_MAP = {
  on_track: 'onTrack',
  over_pace: 'overPace',
  under_pace: 'underPace',
} as const;

export function SafeToSpendHero({ data, currentPreset }: SafeToSpendHeroProps) {
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
          {/* Hero number with preset selector */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">{t('safeToSpend')}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-foreground tabular-nums">
                  R$&nbsp;{centsToDisplay(data.wantsSafeToSpendDaily)}
                </span>
                <span className="text-lg text-muted-foreground">{t('perDay')}</span>
              </div>
            </div>
            <PresetSelector currentPreset={currentPreset} />
          </div>

          {/* Details */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div>
              <span className="font-medium tabular-nums">R$&nbsp;{centsToDisplay(data.wantsSafeToSpend)}</span>
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
                <span className="text-xs text-muted-foreground tabular-nums">
                  {data.pacing.percentageOfExpected}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  role="progressbar"
                  aria-valuenow={Math.round(Math.min(data.pacing.percentageOfExpected, 100))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${tPacing(pacingKey)}: ${data.pacing.percentageOfExpected}%`}
                  className={`h-full ${pacingConfig.barColor} transition-[width] duration-300 motion-reduce:transition-none`}
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
