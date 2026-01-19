'use client';

import { useTranslations } from 'next-intl';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { CategoryIcon } from '@/components/icon-picker';
import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon, Cancel01Icon } from '@hugeicons/core-free-icons';

type ReplenishmentCategory = {
  id: number;
  name: string;
  color: string;
  icon: string | null;
};

type ReplenishmentPickerProps = {
  categories: ReplenishmentCategory[];
  currentCategoryId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (categoryId: number | null) => void;
  isUpdating?: boolean;
};

export function ReplenishmentPicker({
  categories,
  currentCategoryId,
  open,
  onOpenChange,
  onSelect,
  isUpdating = false,
}: ReplenishmentPickerProps) {
  const t = useTranslations('income');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[70vh] flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>{t('replenishBudget')}</SheetTitle>
        </SheetHeader>

        {/* Scrollable list container */}
        <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <div className="flex flex-col">
            {/* None option */}
            <button
              type="button"
              onClick={() => onSelect(null)}
              disabled={isUpdating}
              aria-label={t('noReplenishment')}
              className={cn(
                'flex items-center gap-3 px-4 py-3 transition-all',
                'hover:bg-muted touch-manipulation',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                currentCategoryId === null && 'bg-muted'
              )}
            >
              {/* None icon */}
              <div
                className="size-10 rounded-full flex items-center justify-center bg-gray-400 text-white shrink-0"
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={20}
                  strokeWidth={2}
                />
              </div>

              {/* Label */}
              <span className="flex-1 text-left text-sm">
                {t('noReplenishment')}
              </span>

              {/* Checkmark for selected */}
              {currentCategoryId === null && (
                <HugeiconsIcon
                  icon={Tick02Icon}
                  className="size-5 text-primary shrink-0"
                  strokeWidth={2}
                />
              )}
            </button>

            {/* Expense categories */}
            {categories.map((category) => {
              const isSelected = category.id === currentCategoryId;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onSelect(category.id)}
                  disabled={isUpdating}
                  aria-label={`${t('selectReplenishCategory')}: ${category.name}`}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 transition-all',
                    'hover:bg-muted touch-manipulation',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    isSelected && 'bg-muted'
                  )}
                >
                  {/* Category icon */}
                  <div
                    className="size-10 rounded-full flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: category.color }}
                  >
                    <CategoryIcon icon={category.icon} />
                  </div>

                  {/* Category name */}
                  <span className="flex-1 text-left text-sm">
                    {category.name}
                  </span>

                  {/* Checkmark for selected */}
                  {isSelected && (
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      className="size-5 text-primary shrink-0"
                      strokeWidth={2}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
