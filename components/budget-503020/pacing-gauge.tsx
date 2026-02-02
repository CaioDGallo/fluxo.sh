'use client';

import { Card, CardContent } from '@/components/ui/card';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import type { PacingData } from '@/lib/actions/budget-503020';
import { PACING_CONFIG } from '@/lib/budget-503020-config';
import { useTranslations } from 'next-intl';

interface PacingGaugeProps {
  pacing: PacingData;
  daysRemaining: number;
}

// Map snake_case status values to camelCase translation keys
const PACING_KEY_MAP = {
  on_track: 'onTrack',
  over_pace: 'overPace',
  under_pace: 'underPace',
} as const;

export function PacingGauge({ pacing, daysRemaining }: PacingGaugeProps) {
  const t = useTranslations('budget503020');
  const tPacing = useTranslations('budget503020.pacing');
  const config = PACING_CONFIG[pacing.status];
  const pacingKey = PACING_KEY_MAP[pacing.status];

  const data = [
    {
      name: 'pacing',
      value: Math.min(pacing.percentageOfExpected, 150), // Cap at 150% for visual
      fill: config.hexColor,
    },
  ];

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('spendingPace')}</h3>

          <div className="flex items-center justify-center">
            <div className="relative w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="90%"
                  data={data}
                  startAngle={180}
                  endAngle={0}
                >
                  <RadialBar
                    background={{ fill: '#f3f4f6' }}
                    dataKey="value"
                    cornerRadius={10}
                  />
                </RadialBarChart>
              </ResponsiveContainer>

              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold" style={{ color: config.hexColor }}>
                  {pacing.percentageOfExpected}%
                </span>
                <span className="text-xs text-gray-600 mt-1">{tPacing('ofExpected')}</span>
              </div>
            </div>
          </div>

          <div className="text-center space-y-1">
            <p className="font-medium" style={{ color: config.hexColor }}>
              {tPacing(pacingKey)}
            </p>
            <p className="text-sm text-gray-600">{tPacing(`${pacingKey}Description`)}</p>
            <p className="text-xs text-gray-500">
              {t('daysRemaining', { count: daysRemaining })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
