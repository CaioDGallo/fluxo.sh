'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

type ActiveFilterBadgesProps = {
  category?: { id: number; name: string } | null;
  account?: { id: number; name: string } | null;
  status?: { value: string; label: string } | null;
  onClearCategory: () => void;
  onClearAccount: () => void;
  onClearStatus: () => void;
};

export function ActiveFilterBadges({
  category,
  account,
  status,
  onClearCategory,
  onClearAccount,
  onClearStatus,
}: ActiveFilterBadgesProps) {
  const hasActiveFilters = Boolean(category || account || status);

  if (!hasActiveFilters) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {category && (
        <Badge variant="outline" className="gap-1.5 pl-2.5 pr-1">
          <span>{category.name}</span>
          <Button
            onClick={onClearCategory}
            variant="ghost"
            size="icon"
            className="h-4 w-4 hover:bg-transparent"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="h-3 w-3" />
          </Button>
        </Badge>
      )}
      {account && (
        <Badge variant="outline" className="gap-1.5 pl-2.5 pr-1">
          <span>{account.name}</span>
          <Button
            onClick={onClearAccount}
            variant="ghost"
            size="icon"
            className="h-4 w-4 hover:bg-transparent"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="h-3 w-3" />
          </Button>
        </Badge>
      )}
      {status && (
        <Badge variant="outline" className="gap-1.5 pl-2.5 pr-1">
          <span>{status.label}</span>
          <Button
            onClick={onClearStatus}
            variant="ghost"
            size="icon"
            className="h-4 w-4 hover:bg-transparent"
          >
            <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="h-3 w-3" />
          </Button>
        </Badge>
      )}
    </div>
  );
}
