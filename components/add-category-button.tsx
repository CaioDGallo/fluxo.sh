'use client';

import { CategorySheet } from '@/components/category-sheet';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

type AddCategoryButtonProps = {
  type?: 'expense' | 'income';
  children?: React.ReactNode;
};

export function AddCategoryButton({ type = 'expense', children }: AddCategoryButtonProps) {
  const t = useTranslations('categories');

  return (
    <CategorySheet
      type={type}
      trigger={<Button variant={'hollow'}>{children || t('add')}</Button>}
    />
  );
}
