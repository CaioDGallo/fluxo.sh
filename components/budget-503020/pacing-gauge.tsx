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

interface Point {
  x: number;
  y: number;
}

// Zone definitions — only percentage bounds and colors needed now
const ZONES = [
  {
    name: 'saving',
    startPercent: 0,
    endPercent: 90,
    lightColor: '#60a5fa',
    darkColor: '#60a5fa',
    label: 'Economizando',
  },
  {
    name: 'onTrack',
    startPercent: 90,
    endPercent: 110,
    lightColor: '#4ade80',
    darkColor: '#4ade80',
    label: 'No ritmo',
  },
  {
    name: 'careful',
    startPercent: 110,
    endPercent: 130,
    lightColor: '#fb923c',
    darkColor: '#fb923c',
    label: 'Atenção',
  },
  {
    name: 'over',
    startPercent: 130,
    endPercent: 200,
    lightColor: '#f87171',
    darkColor: '#f87171',
    label: 'Acima',
  },
] as const;

// 7 vertex angles for the half-octagon gauge (same 270° span as before)
// 225° (bottom-left) → 270° → 315° → 0° → 45° → 90° → 135° (bottom-right)
const VERTEX_ANGLES = [225, 270, 315, 360, 405, 450, 495];
const NUM_SEGMENTS = VERTEX_ANGLES.length - 1; // 6
const PCT_PER_SEGMENT = 200 / NUM_SEGMENTS; // ~33.33%

/**
 * Convert polar angle to cartesian point.
 * 0°=top, angles increase clockwise (matching SVG convention with -90° offset).
 */
function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): Point {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

/** Get all 7 octagon vertices for a given radius */
function getVertices(cx: number, cy: number, radius: number): Point[] {
  return VERTEX_ANGLES.map((angle) => polarToCartesian(cx, cy, radius, angle));
}

/** Map 0-200% to a point on the octagonal path by interpolating within segments */
function percentageToPoint(pct: number, cx: number, cy: number, radius: number): Point {
  const clamped = Math.max(0, Math.min(200, pct));
  const segIdx = Math.min(Math.floor(clamped / PCT_PER_SEGMENT), NUM_SEGMENTS - 1);
  const t = (clamped - segIdx * PCT_PER_SEGMENT) / PCT_PER_SEGMENT;
  const vertices = getVertices(cx, cy, radius);
  const a = vertices[segIdx];
  const b = vertices[segIdx + 1];
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

/**
 * Build SVG path for an octagonal zone (donut segment with straight edges).
 * Traces outer vertices from startPct→endPct, then inner vertices back.
 */
function describeOctagonZone(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startPct: number,
  endPct: number
): string {
  const outerVerts = getVertices(cx, cy, outerR);
  const innerVerts = getVertices(cx, cy, innerR);

  // Collect outer path points: start → intermediate vertices → end
  const outerPoints: Point[] = [percentageToPoint(startPct, cx, cy, outerR)];
  for (let i = 0; i < VERTEX_ANGLES.length; i++) {
    const vertPct = i * PCT_PER_SEGMENT;
    if (vertPct > startPct && vertPct < endPct) {
      outerPoints.push(outerVerts[i]);
    }
  }
  outerPoints.push(percentageToPoint(endPct, cx, cy, outerR));

  // Collect inner path points in reverse: end → intermediate vertices → start
  const innerPoints: Point[] = [percentageToPoint(endPct, cx, cy, innerR)];
  for (let i = VERTEX_ANGLES.length - 1; i >= 0; i--) {
    const vertPct = i * PCT_PER_SEGMENT;
    if (vertPct > startPct && vertPct < endPct) {
      innerPoints.push(innerVerts[i]);
    }
  }
  innerPoints.push(percentageToPoint(startPct, cx, cy, innerR));

  // Build path
  const parts: string[] = [`M ${outerPoints[0].x} ${outerPoints[0].y}`];
  for (let i = 1; i < outerPoints.length; i++) {
    parts.push(`L ${outerPoints[i].x} ${outerPoints[i].y}`);
  }
  parts.push(`L ${innerPoints[0].x} ${innerPoints[0].y}`);
  for (let i = 1; i < innerPoints.length; i++) {
    parts.push(`L ${innerPoints[i].x} ${innerPoints[i].y}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/**
 * Build SVG path for the full octagonal track outline (outer + inner border).
 */
function describeOctagonOutline(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number
): string {
  const outerVerts = getVertices(cx, cy, outerR);
  const innerVerts = getVertices(cx, cy, innerR);

  const parts: string[] = [`M ${outerVerts[0].x} ${outerVerts[0].y}`];
  for (let i = 1; i < outerVerts.length; i++) {
    parts.push(`L ${outerVerts[i].x} ${outerVerts[i].y}`);
  }
  // Connect to inner track at the end
  parts.push(`L ${innerVerts[innerVerts.length - 1].x} ${innerVerts[innerVerts.length - 1].y}`);
  for (let i = innerVerts.length - 2; i >= 0; i--) {
    parts.push(`L ${innerVerts[i].x} ${innerVerts[i].y}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/**
 * Convert percentage (0-200%) to angle for needle rotation.
 * Kept from original — needle rotates smoothly regardless of octagonal track.
 */
function percentageToAngle(percentage: number): number {
  const clamped = Math.max(0, Math.min(200, percentage));
  return 225 + clamped * 1.35;
}

export function PacingGauge({ pacing, daysRemaining }: PacingGaugeProps) {
  const t = useTranslations('budget503020');
  const tPacing = useTranslations('budget503020.pacing');
  const config = PACING_CONFIG[pacing.status];
  const pacingKey = PACING_KEY_MAP[pacing.status];

  const needleAngle = useMemo(() => {
    return percentageToAngle(pacing.percentageOfExpected);
  }, [pacing.percentageOfExpected]);

  const activeZone = useMemo(() => {
    return ZONES.find(
      (zone) =>
        pacing.percentageOfExpected >= zone.startPercent &&
        pacing.percentageOfExpected < zone.endPercent
    ) || ZONES[ZONES.length - 1];
  }, [pacing.percentageOfExpected]);

  // SVG dimensions
  const size = 240;
  const center = size / 2;
  const outerRadius = 90;
  const innerRadius = 65;
  const needleLength = 75;

  // ViewBox computed from octagon bounds
  // Outer vertices span ~56.4 to ~183.6 on x, ~30 to ~183.6 on y
  // Top vertex at (120, 30), bottom vertices at y≈183.6
  const viewBoxX = 22;
  const viewBoxY = 22;
  const viewBoxWidth = 196;
  const viewBoxHeight = 170;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('spendingPace')}</h3>

          {/* Gauge SVG */}
          <div className="flex items-center justify-center px-4">
            <svg
              viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
              className="w-full h-full md:max-h-80 max-w-full md:max-w-80"
              role="img"
              aria-label={`${tPacing(pacingKey)}: ${pacing.percentageOfExpected}% ${tPacing('ofExpected')}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Track outline */}
              <path
                d={describeOctagonOutline(center, center, innerRadius, outerRadius)}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                className="text-border"
              />

              {/* Zone fills */}
              <g className="transition-colors duration-200">
                {ZONES.map((zone) => (
                  <path
                    key={zone.name}
                    d={describeOctagonZone(center, center, innerRadius, outerRadius, zone.startPercent, zone.endPercent)}
                    fill="var(--zone-color)"
                    className="dark:hidden"
                    style={{ '--zone-color': zone.lightColor } as React.CSSProperties}
                    opacity={0.8}
                  />
                ))}
                {ZONES.map((zone) => (
                  <path
                    key={`${zone.name}-dark`}
                    d={describeOctagonZone(center, center, innerRadius, outerRadius, zone.startPercent, zone.endPercent)}
                    fill="var(--zone-color)"
                    className="hidden dark:block"
                    style={{ '--zone-color': zone.darkColor } as React.CSSProperties}
                    opacity={0.8}
                  />
                ))}
              </g>

              {/* Zone dividers */}
              {ZONES.slice(0, -1).map((zone) => {
                const dividerOuter = percentageToPoint(zone.endPercent, center, center, outerRadius + 1);
                const dividerInner = percentageToPoint(zone.endPercent, center, center, innerRadius - 1);
                return (
                  <line
                    key={`divider-${zone.name}`}
                    x1={dividerInner.x}
                    y1={dividerInner.y}
                    x2={dividerOuter.x}
                    y2={dividerOuter.y}
                    stroke="currentColor"
                    strokeWidth="2"
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
                  strokeLinecap="square"
                  className="text-foreground"
                  transform={`rotate(${needleAngle} ${center} ${center})`}
                />
                <rect
                  x={center - 5}
                  y={center - 5}
                  width={10}
                  height={10}
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
