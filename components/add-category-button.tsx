'use client';

import { useState } from 'react';
import { CategoryForm } from '@/components/category-form';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTranslations } from 'next-intl';

type AddCategoryButtonProps = {
  type?: 'expense' | 'income';
  children?: React.ReactNode;
};

export function AddCategoryButton({ type = 'expense', children }: AddCategoryButtonProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('categories');

  const title = type === 'expense' ? t('addExpenseCategory') : t('addIncomeCategory');

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={'hollow'}>{children || t('add')}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent closeOnBackdropClick>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>
        <CategoryForm type={type} onSuccess={() => setOpen(false)} />
      </AlertDialogContent>
    </AlertDialog>
  );
}
