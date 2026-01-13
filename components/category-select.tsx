'use client';

import type { Category } from '@/lib/schema';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CategoryIcon } from '@/components/icon-picker';

type CategorySelectProps = {
  categories: Category[];
  value: number;
  onChange: (value: number) => void;
  triggerId?: string;
  triggerTestId?: string;
};

export function CategorySelect({
  categories,
  value,
  onChange,
  triggerId,
  triggerTestId,
}: CategorySelectProps) {
  return (
    <Select value={value.toString()} onValueChange={(v) => onChange(parseInt(v))}>
      <SelectTrigger id={triggerId} data-testid={triggerTestId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id.toString()}>
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
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
