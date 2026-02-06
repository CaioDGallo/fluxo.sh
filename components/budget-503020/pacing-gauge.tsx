'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import type { PacingData } from '@/lib/actions/budget-503020';
import { PACING_CONFIG } from '@/lib/budget-503020-config';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Label, PolarRadiusAxis, RadialBar, RadialBarChart } from 'recharts';

interface PacingGaugeProps {
  pacing: PacingData;
  daysRemaining: number;
}

const PACING_KEY_MAP = {
  on_track: 'onTrack',
  over_pace: 'overPace',
  under_pace: 'underPace',
} as const;

const ZONES = [
  { name: 'saving', startPercent: 0, endPercent: 90, label: 'Economizando' },
  { name: 'onTrack', startPercent: 90, endPercent: 110, label: 'No ritmo' },
  { name: 'careful', startPercent: 110, endPercent: 130, label: 'Atenção' },
  { name: 'over', startPercent: 130, endPercent: 200, label: 'Acima' },
] as const;

const chartConfig = {
  saving: { label: 'Economizando', color: '#60a5fa' },
  onTrack: { label: 'No ritmo', color: '#4ade80' },
  careful: { label: 'Atenção', color: '#fb923c' },
  over: { label: 'Acima', color: '#f87171' },
} satisfies ChartConfig;

/**
 * Map a 0–200% pacing value into fill amounts for each zone segment.
 * Each zone has a max capacity; we fill them sequentially.
 */
function computeZoneData(pct: number) {
  return {
    saving: Math.min(90, Math.max(0, pct)),
    onTrack: Math.min(20, Math.max(0, pct - 90)),
    careful: Math.min(20, Math.max(0, pct - 110)),
    over: Math.min(70, Math.max(0, pct - 130)),
  };
}

/** Convert 0–200% to an angle on the semicircle (180°=left, 0°=right). */
function pctToAngleRad(pct: number): number {
  const clamped = Math.max(0, Math.min(200, pct));
  const angleDeg = 180 - (clamped / 200) * 180;
  return (angleDeg * Math.PI) / 180;
}

export function PacingGauge({ pacing, daysRemaining }: PacingGaugeProps) {
  const t = useTranslations('budget503020');
  const tPacing = useTranslations('budget503020.pacing');
  const config = PACING_CONFIG[pacing.status];
  const pacingKey = PACING_KEY_MAP[pacing.status];

  const chartData = useMemo(
    () => [computeZoneData(pacing.percentageOfExpected)],
    [pacing.percentageOfExpected]
  );

  const activeZone = useMemo(() => {
    return (
      ZONES.find(
        (zone) =>
          pacing.percentageOfExpected >= zone.startPercent &&
          pacing.percentageOfExpected < zone.endPercent
      ) || ZONES[ZONES.length - 1]
    );
  }, [pacing.percentageOfExpected]);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('spendingPace')}</h3>

          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square w-full max-w-[250px]"
          >
            <RadialBarChart
              data={chartData}
              startAngle={180}
              endAngle={0}
              innerRadius={80}
              outerRadius={130}
            >
              <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      const cx = viewBox.cx || 0;
                      const cy = viewBox.cy || 0;
                      const rad = pctToAngleRad(pacing.percentageOfExpected);
                      const needleInner = 70;
                      const needleOuter = 140;
                      const tipX = cx + needleOuter * Math.cos(rad);
                      const tipY = cy - needleOuter * Math.sin(rad);
                      const baseX = cx + needleInner * Math.cos(rad);
                      const baseY = cy - needleInner * Math.sin(rad);

                      return (
                        <g>
                          {/* Needle */}
                          <line
                            x1={baseX}
                            y1={baseY}
                            x2={tipX}
                            y2={tipY}
                            className="stroke-foreground"
                            strokeWidth={3}
                            strokeLinecap="square"
                          />
                          <circle
                            cx={tipX}
                            cy={tipY}
                            r={4}
                            className="fill-foreground"
                          />
                          {/* Center text */}
                          <text x={cx} y={cy} textAnchor="middle">
                            <tspan
                              x={cx}
                              y={cy - 8}
                              className={`fill-current text-3xl font-bold tabular-nums ${config.color}`}
                            >
                              {pacing.percentageOfExpected}%
                            </tspan>
                            <tspan
                              x={cx}
                              y={cy + 12}
                              className="fill-muted-foreground text-sm"
                            >
                              {tPacing('ofExpected')}
                            </tspan>
                          </text>
                        </g>
                      );
                    }
                  }}
                />
              </PolarRadiusAxis>
              <RadialBar
                dataKey="saving"
                stackId="a"
                fill="var(--color-saving)"
                cornerRadius={0}
                className="stroke-transparent stroke-2"
                background
              />
              <RadialBar
                dataKey="onTrack"
                stackId="a"
                fill="var(--color-onTrack)"
                cornerRadius={0}
                className="stroke-transparent stroke-2"
              />
              <RadialBar
                dataKey="careful"
                stackId="a"
                fill="var(--color-careful)"
                cornerRadius={0}
                className="stroke-transparent stroke-2"
              />
              <RadialBar
                dataKey="over"
                stackId="a"
                fill="var(--color-over)"
                cornerRadius={0}
                className="stroke-transparent stroke-2"
              />
            </RadialBarChart>
          </ChartContainer>

          <div className="text-center space-y-3">
            <div>
              <p className={`text-lg font-semibold ${config.color}`}>
                {activeZone.label}
              </p>
              <p className="text-sm text-muted-foreground">
                {tPacing(`${pacingKey}Description`)}
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              {t('daysRemaining', { count: daysRemaining })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
