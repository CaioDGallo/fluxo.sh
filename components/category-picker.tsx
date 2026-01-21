'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { Category } from '@/lib/schema';
import type { RecentCategory } from '@/lib/actions/categories';
import { CategoryIcon } from '@/components/icon-picker';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const RECENT_LIMIT = 3;

type CategoryPickerProps = {
  categories: Category[];
  recentCategories: RecentCategory[];
  value: number;
  onChange: (value: number) => void;
  triggerId?: string;
};

function resolveCategoryOptions(categories: Category[]) {
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
  }));
}

export function CategoryPicker({
  categories,
  recentCategories,
  value,
  onChange,
  triggerId,
}: CategoryPickerProps) {
  const t = useTranslations('form');
  const categoryOptions = useMemo(() => resolveCategoryOptions(categories), [categories]);
  const selectedCategory = categoryOptions.find((category) => category.id === value) || null;

  const recentOptions = useMemo(() => {
    if (recentCategories.length === 0) return [];
    const used = new Set<number>();

    return recentCategories
      .filter((category) => categories.some((item) => item.id === category.id))
      .filter((category) => {
        if (used.has(category.id)) return false;
        used.add(category.id);
        return true;
      })
      .slice(0, RECENT_LIMIT)
      .map((category) => ({
        id: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
      }));
  }, [categories, recentCategories]);

  const showSelectedLabel = !!selectedCategory && !recentOptions.some((category) => category.id === value);

  return (
    <div className="space-y-2 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 min-h-8 w-full">
        <Select
          value={value ? value.toString() : ''}
          onValueChange={(next) => onChange(parseInt(next, 10))}
        >
          <SelectTrigger id={triggerId} className="min-w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {categoryOptions.length > 0 ? (
                categoryOptions.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    <div className="flex items-center gap-2">
                      <CategoryIconDisplay color={category.color} icon={category.icon} />
                      <span>{category.name}</span>
                    </div>
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="" disabled>
                  {t('noCategoriesFound')}
                </SelectItem>
              )}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {recentOptions.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {recentOptions.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onChange(category.id)}
              className={cn(
                'flex items-center gap-2 rounded-none border px-2.5 py-1 text-xs transition',
                'bg-background hover:bg-muted',
                value === category.id
                  ? 'border-primary text-primary shadow-[2px_2px_0px_rgba(0,0,0,0.5)]'
                  : 'border-border text-foreground'
              )}
              aria-pressed={value === category.id}
            >
              <CategoryIconDisplay color={category.color} icon={category.icon} />
              <span className="truncate max-w-40">{category.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          {t('noRecentCategories')}
        </div>
      )}

      {showSelectedLabel && (
        <div className="text-xs text-muted-foreground">
          {t('selectedCategory', { category: selectedCategory.name })}
        </div>
      )}
    </div>
  );
}

function CategoryIconDisplay({ color, icon }: { color: string; icon: string | null }) {
  return (
    <div
      className="size-5 rounded-full flex items-center justify-center shrink-0"
      style={{ backgroundColor: color }}
    >
      <div className="text-white [&_svg]:size-3">
        <CategoryIcon icon={icon || 'default'} />
      </div>
    </div>
  );
}
