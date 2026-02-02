'use client';

import { Card, CardContent } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { CategoryIcon } from '@/components/icon-picker';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon } from '@hugeicons/core-free-icons';

type CategoryBudgetRowProps = {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  value: number;
  onChange: (cents: number) => void;
  error?: string;
  isSaving?: boolean;
  disabled?: boolean;
};

export function CategoryBudgetRow({
  categoryId,
  categoryName,
  categoryColor,
  categoryIcon,
  value,
  onChange,
  error,
  isSaving = false,
  disabled = false,
}: CategoryBudgetRowProps) {
  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3">
        {/* Category icon */}
        <div
          className="size-10 shrink-0 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: categoryColor }}
        >
          <CategoryIcon icon={categoryIcon} />
        </div>

        {/* Category name */}
        <div className="flex-1 min-w-0">
          <span className="font-medium text-sm truncate block">{categoryName}</span>
        </div>

        {/* Budget input */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="relative">
            <CurrencyInput
              aria-label={categoryName}
              name={`budget-${categoryId}`}
              value={value}
              onChange={onChange}
              className="w-32 sm:w-40 text-right tabular-nums"
              disabled={disabled}
            />
            {isSaving && (
              <span className="absolute right-10 top-1/2 -translate-y-1/2">
                <HugeiconsIcon icon={Loading03Icon} className="size-3 animate-spin" aria-hidden="true" />
              </span>
            )}
          </div>
          {error && (
            <span className="text-xs text-red-600">{error}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
