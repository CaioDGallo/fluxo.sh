'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
  CATEGORY_ICONS,
  CategoryIcon,
  type IconName,
  isValidIconName,
} from '@/components/category-icon';
import { cn } from '@/lib/utils';

export { CATEGORY_ICONS, CategoryIcon, isValidIconName };
export type { IconName };

type IconPickerProps = {
  value: IconName | null;
  onChange: (icon: IconName) => void;
};

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="grid grid-cols-7 md:flex gap-2">
      {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(name as IconName)}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-none border dark:hover:bg-neutral-700 hover:bg-neutral-100',
            value === name && 'border-blue-500 bg-blue-50 dark:bg-neutral-700 ring-2 ring-blue-500'
          )}
        >
          <HugeiconsIcon icon={Icon} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
