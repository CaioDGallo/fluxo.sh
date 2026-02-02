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

// Zone definitions for the speedometer gauge
// Speedometer arc: 225° (7 o'clock) → 360°/0° (12 o'clock) → 495°/135° (5 o'clock)
// Total span: 270° going counter-clockwise (increasing angles)
// With polarToCartesian's (angle - 90) transform: 0°=UP, 90°=RIGHT, 180°=DOWN, 270°=LEFT
const ZONES = [
  {
    name: 'saving',
    startPercent: 0,
    endPercent: 90,
    startAngle: 225,      // Bottom-left (7 o'clock)
    endAngle: 346.5,      // Approaching top from left (wraps to -13.5°)
    lightColor: '#3b82f6', // blue-500
    darkColor: '#60a5fa',  // blue-400
    label: 'Economizando',
  },
  {
    name: 'onTrack',
    startPercent: 90,
    endPercent: 110,
    startAngle: 346.5,    // Approaching top
    endAngle: 373.5,      // Just past top (wraps to 13.5°)
    lightColor: '#22c55e', // green-500
    darkColor: '#4ade80',  // green-400
    label: 'No ritmo',
  },
  {
    name: 'careful',
    startPercent: 110,
    endPercent: 130,
    startAngle: 373.5,    // Past top (wraps to 13.5°)
    endAngle: 400.5,      // Upper right (wraps to 40.5°)
    lightColor: '#f97316', // orange-500
    darkColor: '#fb923c',  // orange-400
    label: 'Atenção',
  },
  {
    name: 'over',
    startPercent: 130,
    endPercent: 200,
    startAngle: 400.5,    // Upper right (wraps to 40.5°)
    endAngle: 495,        // Bottom-right (5 o'clock, wraps to 135°)
    lightColor: '#ef4444', // red-500
    darkColor: '#f87171',  // red-400
    label: 'Acima',
  },
] as const;

/**
 * Convert percentage (0-200%) to angle for speedometer
 * 0% = 225° (7 o'clock), 100% = 360° (12 o'clock), 200% = 495°/135° (5 o'clock)
 * Spans 270° counter-clockwise (increasing angles) from bottom-left through top to bottom-right
 */
function percentageToAngle(percentage: number): number {
  const clamped = Math.max(0, Math.min(200, percentage));
  // Each 1% = 270° / 200 = 1.35°, going counter-clockwise (increasing angles)
  return 225 + (clamped * 1.35);
}

/**
 * Generate SVG path for ring/donut segment
 * Creates a closed path that traces outer arc, then inner arc in reverse
 */
function describeRingSegment(
  x: number,
  y: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const outerStart = polarToCartesian(x, y, outerRadius, startAngle);
  const outerEnd = polarToCartesian(x, y, outerRadius, endAngle);
  const innerStart = polarToCartesian(x, y, innerRadius, startAngle);
  const innerEnd = polarToCartesian(x, y, innerRadius, endAngle);

  // Calculate angular distance for counter-clockwise (increasing angles)
  const angularDistance = endAngle - startAngle;
  const largeArcFlag = angularDistance > 180 ? '1' : '0';

  return [
    'M', outerStart.x, outerStart.y,
    // sweep-flag=1 for counter-clockwise (increasing angles in our system)
    'A', outerRadius, outerRadius, 0, largeArcFlag, 1, outerEnd.x, outerEnd.y,
    'L', innerEnd.x, innerEnd.y,
    // sweep-flag=0 for clockwise return
    'A', innerRadius, innerRadius, 0, largeArcFlag, 0, innerStart.x, innerStart.y,
    'Z'
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

  // Find the active zone based on percentage
  const activeZone = useMemo(() => {
    return ZONES.find(
      (zone) =>
        pacing.percentageOfExpected >= zone.startPercent &&
        pacing.percentageOfExpected < zone.endPercent
    ) || ZONES[ZONES.length - 1]; // Default to last zone if over 200%
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

          {/* Gauge SVG */}
          <div className="flex items-center justify-center">
            <svg
              viewBox={`0 0 ${size} ${size}`}
              className="w-full h-full max-w-full md:max-w-70"
              role="img"
              aria-label={`${tPacing(pacingKey)}: ${pacing.percentageOfExpected}% ${tPacing('ofExpected')}`}
            >
              {/* Background zones */}
              <g className="transition-colors duration-200">
                {ZONES.map((zone) => (
                  <path
                    key={zone.name}
                    d={describeRingSegment(center, center, innerRadius, outerRadius, zone.startAngle, zone.endAngle)}
                    fill="var(--zone-color)"
                    className="dark:hidden"
                    style={{ '--zone-color': zone.lightColor } as React.CSSProperties}
                    opacity={0.2}
                  />
                ))}
                {ZONES.map((zone) => (
                  <path
                    key={`${zone.name}-dark`}
                    d={describeRingSegment(center, center, innerRadius, outerRadius, zone.startAngle, zone.endAngle)}
                    fill="var(--zone-color)"
                    className="hidden dark:block"
                    style={{ '--zone-color': zone.darkColor } as React.CSSProperties}
                    opacity={0.2}
                  />
                ))}
              </g>

              {/* Zone dividers */}
              {ZONES.slice(0, -1).map((zone) => {
                const dividerOuter = polarToCartesian(center, center, outerRadius, zone.endAngle);
                const dividerInner = polarToCartesian(center, center, innerRadius, zone.endAngle);
                return (
                  <line
                    key={`divider-${zone.name}`}
                    x1={dividerInner.x}
                    y1={dividerInner.y}
                    x2={dividerOuter.x}
                    y2={dividerOuter.y}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-muted-foreground/20"
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
            </svg>
          </div>

          {/* Gauge metrics below SVG */}
          <div className="text-center space-y-3">
            <div>
              <div className={`text-4xl font-bold tabular-nums ${config.color}`}>
                {pacing.percentageOfExpected}%
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {tPacing('ofExpected')}
              </p>
            </div>

            {/* Active zone label */}
            <div>
              <p className={`text-lg font-semibold ${config.color}`}>
                {activeZone.label}
              </p>
              <p className="text-sm text-muted-foreground">{tPacing(`${pacingKey}Description`)}</p>
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
