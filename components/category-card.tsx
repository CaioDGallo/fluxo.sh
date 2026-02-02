'use client';

import { useState } from 'react';
import { deleteCategory, setImportDefault } from '@/lib/actions/categories';
import type { Category } from '@/lib/schema';
import { CategoryForm } from '@/components/category-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CategoryIcon } from '@/components/icon-picker';
import { HugeiconsIcon } from '@hugeicons/react';
import { UploadCircle02Icon, MoreVerticalIcon, Home01Icon, GameController01Icon, PiggyBankIcon } from '@hugeicons/core-free-icons';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BucketType } from '@/lib/actions/budget-503020';

type CategoryCardProps = {
  category: Category;
};

const BUCKET_CONFIG: Record<BucketType, { label: string; icon: typeof Home01Icon; className: string }> = {
  necessities: {
    label: 'Necessidades',
    icon: Home01Icon,
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  wants: {
    label: 'Desejos',
    icon: GameController01Icon,
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
  savings: {
    label: 'Poupança',
    icon: PiggyBankIcon,
    className: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
};

export function CategoryCard({ category }: CategoryCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingDefault, setIsUpdatingDefault] = useState(false);
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');

  const bucketConfig = category.bucket ? BUCKET_CONFIG[category.bucket as BucketType] : null;

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await deleteCategory(category.id);

      if (!result.success) {
        setDeleteError(result.error);
        return;
      }

      setDeleteOpen(false);
    } catch (err) {
      console.error('[CategoryCard] Delete failed:', err);
      setDeleteError(tCommon('unexpectedError'));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleToggleImportDefault() {
    setIsUpdatingDefault(true);

    try {
      const result = await setImportDefault(category.id, !category.isImportDefault);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(
        category.isImportDefault
          ? t('removedImportDefault')
          : t('setAsImportDefaultSuccess')
      );
    } catch (err) {
      console.error('[CategoryCard] Toggle import default failed:', err);
      toast.error(tCommon('unexpectedError'));
    } finally {
      setIsUpdatingDefault(false);
    }
  }

  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3">
        {/* Category icon */}
        <div
          className="size-10 shrink-0 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: category.color }}
        >
          <CategoryIcon icon={category.icon} />
        </div>

        {/* Category name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-sm truncate">{category.name}</h3>
            {bucketConfig && (
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full whitespace-nowrap flex items-center gap-1",
                bucketConfig.className
              )}>
                <HugeiconsIcon icon={bucketConfig.icon} strokeWidth={1} size={12} />
                <span className='hidden sm:inline'>{bucketConfig.label}</span>
              </span>
            )}
            {category.isImportDefault && (
              <span className="text-xs p-1 md:px-2 md:py-0.5 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 whitespace-nowrap">
                <span className='hidden md:flex'>{t('importDefault')}</span>
                <HugeiconsIcon icon={UploadCircle02Icon} strokeWidth={1} className='flex md:hidden' />
              </span>
            )}
          </div>
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={handleToggleImportDefault}
              disabled={isUpdatingDefault}
            >
              {category.isImportDefault ? t('removeImportDefault') : t('setAsImportDefault')}
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              {tCommon('edit')} {t('title')}
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={() => setDeleteOpen(true)}>
              {tCommon('delete')} {t('title')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={editOpen} onOpenChange={setEditOpen}>
          <AlertDialogContent closeOnBackdropClick>
            <AlertDialogHeader>
              <AlertDialogTitle>{tCommon('edit')} {t('title')}</AlertDialogTitle>
            </AlertDialogHeader>
            <CategoryForm
              category={category}
              onSuccess={() => setEditOpen(false)}
            />
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tCommon('delete')} {t('title')}?</AlertDialogTitle>
              <AlertDialogDescription>
                {tCommon('actionCannotBeUndone')}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {deleteError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {deleteError}
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>{tCommon('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? tCommon('deleting') : tCommon('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </CardContent>
    </Card>
  );
}
