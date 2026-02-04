'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { createCategory, updateCategory } from '@/lib/actions/categories';
import type { Category } from '@/lib/schema';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { IconPicker, isValidIconName, type IconName } from '@/components/icon-picker';
import { CategoryBucketPicker } from '@/components/category-bucket-picker';
import { cn } from '@/lib/utils';
import type { BucketType } from '@/lib/actions/budget-503020';

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
];

type CategorySheetProps = {
  category?: Category;
  type?: 'expense' | 'income';
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
};

export function CategorySheet({
  category,
  type = 'expense',
  trigger,
  open: controlledOpen,
  onOpenChange,
  onSuccess,
}: CategorySheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const t = useTranslations('categoryForm');
  const tCommon = useTranslations('common');
  const tCategories = useTranslations('categories');
  const tBudget503020 = useTranslations('budget503020');

  const [name, setName] = useState(category?.name || '');
  const [color, setColor] = useState(category?.color || COLORS[0]);
  const [icon, setIcon] = useState<IconName | null>(() => {
    const iconValue = category?.icon ?? null;
    return isValidIconName(iconValue) ? iconValue : null;
  });
  const [bucket, setBucket] = useState<BucketType | null>(
    (category?.bucket as BucketType | null) ?? null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = category
        ? await updateCategory(category.id, { name, color, icon, bucket })
        : await createCategory({ name, color, icon, bucket, type });

      if (!result.success) {
        setError(result.error);
        return;
      }

      if (category) {
        // Close immediately for better perceived performance
        setOpen(false);
      } else {
        // Reset form for new category
        setName('');
        setColor(COLORS[0]);
        setIcon(null);
        setBucket(null);
        setOpen(false);
      }

      onSuccess?.();
    } catch (err) {
      const operation = category ? 'update' : 'create';
      console.error(`[CategorySheet] ${operation} failed:`, {
        operation,
        categoryId: category?.id,
        categoryName: name,
        type,
        error: err,
      });
      setError(tCommon('unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = category
    ? `${tCommon('edit')} ${tCategories('title')}`
    : type === 'expense'
      ? tCategories('addExpenseCategory')
      : tCategories('addIncomeCategory');

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent
        side="bottom"
        className="max-h-[80vh] p-0 flex flex-col"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
            nameInputRef.current?.focus();
          }
        }}
      >
        <SheetHeader className="border-b border-border/60 bg-muted/70 dark:bg-muted/20 px-4 py-3">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
            <SheetTitle className="text-start text-sm font-semibold text-balance">{title}</SheetTitle>
            <div className="flex items-center gap-2">
              <span
                className="size-4 rounded-full border border-green-700 bg-green-500 shadow-[1px_1px_0px_rgba(0,0,0,0.6)]"
                aria-hidden
              />
              <span
                className="size-4 rounded-full border border-amber-600 bg-amber-400 shadow-[1px_1px_0px_rgba(0,0,0,0.6)]"
                aria-hidden
              />
              <SheetClose asChild>
                <button
                  type="button"
                  className="group size-4 rounded-full border border-red-700 bg-red-500 text-[10px] font-bold text-red-950 shadow-[1px_1px_0px_rgba(0,0,0,0.6)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                  aria-label={tCommon('close')}
                >
                  <span className="relative block -mt-px text-white leading-none opacity-80 group-hover:opacity-100">
                    <span className='w-14 h-10 absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2' />
                    x
                  </span>
                </button>
              </SheetClose>
            </div>
          </div>
          <SheetDescription className="sr-only">
            {category ? tCommon('edit') : tCommon('create')} {tCategories('title')}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex bg-muted/20 dark:bg-muted flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
            <FieldGroup>
              {/* Name */}
              <Field>
                <FieldLabel htmlFor="name">{t('name')}</FieldLabel>
                <Input
                  ref={nameInputRef}
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Food & Dining"
                  autoComplete="off"
                />
              </Field>

              {/* Color */}
              <Field>
                <FieldLabel>{t('color')}</FieldLabel>
                <div className="grid grid-cols-8 md:flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        'h-10 w-10 rounded-full transition-all touch-manipulation',
                        color === c && 'ring-2 ring-blue-500 ring-offset-2'
                      )}
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                      aria-pressed={color === c}
                    />
                  ))}
                </div>
              </Field>

              {/* Icon */}
              <Field>
                <FieldLabel>{t('icon')}</FieldLabel>
                <IconPicker value={icon} onChange={setIcon} />
              </Field>

              {/* Bucket (expense only) */}
              {type === 'expense' && (
                <Field>
                  <FieldLabel>{tBudget503020('bucketCategory')}</FieldLabel>
                  <CategoryBucketPicker
                    value={bucket}
                    onChange={setBucket}
                    disabled={isSubmitting}
                  />
                </Field>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
                  {error}
                </div>
              )}
            </FieldGroup>
          </div>

          <SheetFooter className="border-t border-border/60 bg-muted/70 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? tCommon('saving') : category ? tCommon('update') : tCommon('create')}
            </Button>
            <SheetClose asChild>
              <Button type="button" variant="outline">
                {tCommon('cancel')}
              </Button>
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
