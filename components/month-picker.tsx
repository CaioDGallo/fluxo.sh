'use client';

import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon, Loading03Icon } from '@hugeicons/core-free-icons';
import { useMonthNavigation } from '@/lib/hooks/use-month-navigation';
import type { PageType } from '@/lib/utils/month-fetcher';
import { cn } from '@/lib/utils';

interface MonthPickerProps {
  pageType: PageType;
}

export function MonthPicker({ pageType }: MonthPickerProps) {
  const { navigateMonth, navigating, currentMonth } = useMonthNavigation({ pageType });

  const [year, month] = currentMonth.split('-');
  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString(
    'pt-BR',
    { month: 'long', year: 'numeric' }
  );

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={() => navigateMonth(-1)}
        variant="hollow"
        size="icon"
        disabled={navigating}
      >
        <HugeiconsIcon
          icon={navigating ? Loading03Icon : ArrowLeft01Icon}
          strokeWidth={2}
          className={cn(navigating && 'animate-spin')}
        />
      </Button>
      <span className={cn(
        'min-w-48 text-center text-lg font-medium capitalize',
        navigating && 'text-muted-foreground'
      )}>
        {monthName}
      </span>
      <Button
        onClick={() => navigateMonth(1)}
        variant="hollow"
        size="icon"
        disabled={navigating}
      >
        <HugeiconsIcon
          icon={navigating ? Loading03Icon : ArrowRight01Icon}
          strokeWidth={2}
          className={cn(navigating && 'animate-spin')}
        />
      </Button>
    </div>
  );
}
