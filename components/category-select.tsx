'use client';

import type { Category } from '@/lib/schema';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '@/components/ui/combobox';
import { CategoryIcon } from '@/components/icon-picker';

type CategorySelectProps = {
  categories: Category[];
  value: number;
  onChange: (value: number) => void;
};

export function CategorySelect({ categories, value, onChange }: CategorySelectProps) {
  return (
    <Combobox
      items={categories}
      value={value.toString()}
      onValueChange={(val) => val && onChange(parseInt(val))}
    >
      <ComboboxInput placeholder="Select category..." />
      <ComboboxContent>
        <ComboboxEmpty>No categories found</ComboboxEmpty>
        <ComboboxList>
          {(category) => (
            <ComboboxItem key={category.id} value={category.id.toString()}>
              <div className="flex items-center gap-2">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full shrink-0"
                  style={{ backgroundColor: category.color }}
                >
                  <div className="text-white [&_svg]:size-3">
                    <CategoryIcon icon={category.icon} />
                  </div>
                </div>
                <span>{category.name}</span>
              </div>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
