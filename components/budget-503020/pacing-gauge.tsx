'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { PacingData } from '@/lib/actions/budget-503020';
import { PACING_CONFIG } from '@/lib/budget-503020-config';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

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

// Zone definitions for the velocimeter
// Each zone represents a spending pace range
const ZONES = [
  {
    name: 'saving',
    startPercent: 0,
    endPercent: 90,
    startAngle: 180,
    endAngle: 99,
    lightColor: '#3b82f6', // blue-500
    darkColor: '#60a5fa',  // blue-400
    label: 'Economizando',
  },
  {
    name: 'onTrack',
    startPercent: 90,
    endPercent: 110,
    startAngle: 99,
    endAngle: 81,
    lightColor: '#22c55e', // green-500
    darkColor: '#4ade80',  // green-400
    label: 'No ritmo',
  },
  {
    name: 'careful',
    startPercent: 110,
    endPercent: 130,
    startAngle: 81,
    endAngle: 63,
    lightColor: '#f97316', // orange-500
    darkColor: '#fb923c',  // orange-400
    label: 'Atenção',
  },
  {
    name: 'over',
    startPercent: 130,
    endPercent: 200,
    startAngle: 63,
    endAngle: 0,
    lightColor: '#ef4444', // red-500
    darkColor: '#f87171',  // red-400
    label: 'Acima',
  },
] as const;

/**
 * Convert percentage (0-200%) to angle (180° to 0°)
 * 0% = 180° (left), 100% = 90°, 200% = 0° (right)
 */
function percentageToAngle(percentage: number): number {
  const clamped = Math.max(0, Math.min(200, percentage));
  return 180 - (clamped / 200 * 180);
}

/**
 * Generate SVG path for arc segment
 */
function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = startAngle - endAngle <= 180 ? '0' : '1';

  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
  ].join(' ');
}

/**
 * Convert polar coordinates to cartesian
 */
function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
): { x: number; y: number } {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

export function PacingGauge({ pacing, daysRemaining }: PacingGaugeProps) {
  const t = useTranslations('budget503020');
  const tPacing = useTranslations('budget503020.pacing');
  const config = PACING_CONFIG[pacing.status];
  const pacingKey = PACING_KEY_MAP[pacing.status];

  const needleAngle = useMemo(() => {
    return percentageToAngle(pacing.percentageOfExpected);
  }, [pacing.percentageOfExpected]);

  // SVG dimensions
  const size = 240;
  const center = size / 2;
  const outerRadius = 90;
  const innerRadius = 65;
  const needleLength = 75;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('spendingPace')}</h3>

          <div className="flex items-center justify-center">
            <div className="relative w-full max-w-[240px] aspect-square">
              <svg
                viewBox={`0 0 ${size} ${size}`}
                className="w-full h-full"
                role="img"
                aria-label={`${tPacing(pacingKey)}: ${pacing.percentageOfExpected}% ${tPacing('ofExpected')}`}
              >
                {/* Background zones */}
                <g className="transition-colors duration-200">
                  {ZONES.map((zone) => (
                    <path
                      key={zone.name}
                      d={describeArc(center, center, outerRadius, zone.startAngle, zone.endAngle)}
                      fill="none"
                      stroke="var(--zone-color)"
                      strokeWidth={outerRadius - innerRadius}
                      strokeLinecap="round"
                      className="dark:hidden"
                      style={{ '--zone-color': zone.lightColor } as React.CSSProperties}
                      opacity={0.2}
                    />
                  ))}
                  {ZONES.map((zone) => (
                    <path
                      key={`${zone.name}-dark`}
                      d={describeArc(center, center, outerRadius, zone.startAngle, zone.endAngle)}
                      fill="none"
                      stroke="var(--zone-color)"
                      strokeWidth={outerRadius - innerRadius}
                      strokeLinecap="round"
                      className="hidden dark:block"
                      style={{ '--zone-color': zone.darkColor } as React.CSSProperties}
                      opacity={0.2}
                    />
                  ))}
                </g>

                {/* Zone dividers */}
                {ZONES.slice(0, -1).map((zone) => {
                  const dividerPos = polarToCartesian(center, center, outerRadius + 5, zone.endAngle);
                  const dividerInner = polarToCartesian(center, center, innerRadius - 5, zone.endAngle);
                  return (
                    <line
                      key={`divider-${zone.name}`}
                      x1={dividerInner.x}
                      y1={dividerInner.y}
                      x2={dividerPos.x}
                      y2={dividerPos.y}
                      stroke="currentColor"
                      strokeWidth="1"
                      className="text-muted-foreground/30"
                    />
                  );
                })}

                {/* Needle */}
                <g
                  className="transition-transform duration-500 ease-out motion-reduce:transition-none"
                  style={{ transformOrigin: `${center}px ${center}px` }}
                >
                  <line
                    x1={center}
                    y1={center}
                    x2={center}
                    y2={center - needleLength}
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="text-foreground"
                    transform={`rotate(${needleAngle} ${center} ${center})`}
                  />
                  <circle
                    cx={center}
                    cy={center}
                    r="6"
                    fill="currentColor"
                    className="text-foreground"
                  />
                </g>

                {/* Zone labels */}
                {ZONES.map((zone) => {
                  const midAngle = (zone.startAngle + zone.endAngle) / 2;
                  const labelRadius = outerRadius + 20;
                  const labelPos = polarToCartesian(center, center, labelRadius, midAngle);

                  return (
                    <text
                      key={`label-${zone.name}`}
                      x={labelPos.x}
                      y={labelPos.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-[10px] font-medium fill-muted-foreground"
                    >
                      {zone.label}
                    </text>
                  );
                })}
              </svg>

              {/* Center text overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="mt-8">
                  <span className={`text-3xl font-bold tabular-nums ${config.color}`}>
                    {pacing.percentageOfExpected}%
                  </span>
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    {tPacing('ofExpected')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center space-y-1">
            <p className={`font-medium ${config.color}`}>
              {tPacing(pacingKey)}
            </p>
            <p className="text-sm text-muted-foreground">{tPacing(`${pacingKey}Description`)}</p>
            <p className="text-xs text-muted-foreground">
              {t('daysRemaining', { count: daysRemaining })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
