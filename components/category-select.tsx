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
  const items = categories.map(c => ({
    ...c,
    value: c.id.toString(),
    label: c.name,
  }));

  const selectedItem = items.find(i => i.id === value) ?? null;

  return (
    <Combobox
      items={items}
      value={selectedItem}
      onValueChange={(item) => item && onChange(item.id)}
    >
      <ComboboxInput placeholder="Select category..." />
      <ComboboxContent>
        <ComboboxEmpty>No categories found</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.id} value={item}>
              <div className="flex items-center gap-2">
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                >
                  <div className="text-white [&_svg]:size-3">
                    <CategoryIcon icon={item.icon} />
                  </div>
                </div>
                <span>{item.name}</span>
              </div>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
