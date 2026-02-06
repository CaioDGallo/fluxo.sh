'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatCurrencyWithLocale } from '@/lib/utils';
import type { SafeToSpendData, PresetType } from '@/lib/actions/budget-503020';
import { PACING_CONFIG } from '@/lib/budget-503020-config';
import { useTranslations, useLocale } from 'next-intl';
import { PresetSelector } from './preset-selector';
import { PacingZoneBar } from './pacing-zone-bar';

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
  const locale = useLocale();
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
                  {formatCurrencyWithLocale(data.wantsSafeToSpendDaily, locale)}
                </span>
                <span className="text-lg text-muted-foreground">{t('perDay')}</span>
              </div>
            </div>
            <div className='absolute right-12'>
              <PresetSelector currentPreset={currentPreset} />
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <div>
              <span className="font-medium tabular-nums">{formatCurrencyWithLocale(data.wantsSafeToSpend, locale)}</span>
              {' '}{t('remaining')}
            </div>
            <div className="hidden sm:block">•</div>
            <div>
              {t('daysRemaining', { count: data.daysRemaining })}
            </div>
          </div>

          {/* Pacing indicator with zone visualization */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
              <span className={`text-sm font-medium ${pacingConfig.color}`}>
                {tPacing(pacingKey)}
              </span>
              <span className="text-xs text-muted-foreground">
                {tPacing(`${pacingKey}Description`)}
              </span>
            </div>
            <PacingZoneBar percentage={data.pacing.percentageOfExpected} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
