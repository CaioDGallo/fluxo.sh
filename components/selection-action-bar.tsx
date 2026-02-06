'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loading03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

type SelectionActionBarProps = {
  selectedCount: number;
  onChangeCategory: () => void;
  onCancel: () => void;
  isUpdating?: boolean;
  changeCategoryLabel: string;
  cancelLabel: string;
  selectedLabel: string;
};

export function SelectionActionBar({
  selectedCount,
  onChangeCategory,
  onCancel,
  isUpdating = false,
  changeCategoryLabel,
  cancelLabel,
  selectedLabel,
}: SelectionActionBarProps) {
  return (
    <div
      className={cn(
        'fixed bottom-16 inset-x-0 z-40 md:hidden',
        'backdrop-blur-xl bg-background/95 border-t border-border',
        'pb-[env(safe-area-inset-bottom)]',
        'shadow-lg'
      )}
    >
      <div className="flex items-center justify-between gap-4 h-14 px-4">
        {/* Selected count */}
        <div className="text-sm font-medium">
          {selectedCount} {selectedLabel}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isUpdating}
            className="touch-manipulation"
          >
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            onClick={onChangeCategory}
            disabled={isUpdating}
            className="touch-manipulation"
          >
            {isUpdating && <HugeiconsIcon icon={Loading03Icon} className="mr-2 size-4 animate-spin" />}
            {changeCategoryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
