'use client';

import { useTranslations } from 'next-intl';

interface PacingZoneBarProps {
  percentage: number;
  className?: string;
}

/**
 * Multi-zone spending pace visualization
 * Shows 4 distinct zones: Saving (0-90%), On Track (90-110%), Careful (110-130%), Over (130%+)
 * Displays a marker indicating current position with percentage label
 */
export function PacingZoneBar({ percentage, className }: PacingZoneBarProps) {
  const t = useTranslations('budget503020.pacing.zones');

  // Scale percentage for visual display (cap at 200% mapped to 100% width)
  const visualPercentage = Math.min(percentage / 2, 100);

  return (
    <div className={className}>
      {/* Zone bar */}
      <div className="relative h-8 bg-muted rounded-none overflow-hidden">
        {/* Zone backgrounds */}
        <div className="absolute inset-0 flex">
          <div className="w-[45%] bg-blue-400/80" aria-label={t('saving')} />
          <div className="w-[10%] bg-green-400/80" aria-label={t('onTrack')} />
          <div className="w-[10%] bg-orange-400/80" aria-label={t('careful')} />
          <div className="w-[35%] bg-red-400/80" aria-label={t('over')} />
        </div>

        {/* Zone separators */}
        <div className="absolute inset-y-0 left-[45%] w-px bg-border" />
        <div className="absolute inset-y-0 left-[55%] w-px bg-border" />
        <div className="absolute inset-y-0 left-[65%] w-px bg-border" />

        {/* Current position marker */}
        <div
          className="absolute inset-y-0 w-2 border border-amber-600 bg-amber-300 rounded-none shadow-sm"
          style={{ left: `${visualPercentage}%`, transform: 'translateX(-50%)' }}
          role="progressbar"
          aria-valuenow={Math.round(percentage)}
          aria-valuemin={0}
          aria-valuemax={200}
          aria-label={`${percentage}%`}
        >
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="text-xs font-semibold tabular-nums bg-background px-1.5 py-0.5 rounded shadow-sm border">
              {percentage}%
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-1">
        <span className="text-left">{t('saving')}<br /><span className="text-[9px]">{t('savingRange')}</span></span>
        <span className="text-center">{t('onTrack')}<br /><span className="text-[9px]">{t('onTrackRange')}</span></span>
        <span className="text-center">{t('careful')}<br /><span className="text-[9px]">{t('carefulRange')}</span></span>
        <span className="text-right">{t('over')}<br /><span className="text-[9px]">{t('overRange')}</span></span>
      </div>
    </div>
  );
}
