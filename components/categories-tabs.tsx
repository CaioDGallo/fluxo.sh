'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddCategoryButton } from '@/components/add-category-button';
import { CategoryCard } from '@/components/category-card';
import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import type { Category } from '@/lib/schema';

interface CategoriesTabsProps {
  expenseCategories: Category[];
  incomeCategories: Category[];
}

export function CategoriesTabs({ expenseCategories, incomeCategories }: CategoriesTabsProps) {
  const t = useTranslations('categories');

  const unassignedExpenseCategories = expenseCategories.filter(cat => !cat.bucket);

  return (
    <Tabs defaultValue="expense" className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-6 rounded-lg h-10">
        <TabsTrigger value="expense" className="rounded-md data-active:shadow-sm">
          {t('expenses')}
        </TabsTrigger>
        <TabsTrigger value="income" className="rounded-md data-active:shadow-sm">
          {t('income')}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="expense" className="mt-0">
        <div className="mb-3 flex items-center justify-end">
          <AddCategoryButton type="expense">{t('addExpenseCategory')}</AddCategoryButton>
        </div>

        {unassignedExpenseCategories.length > 0 && (
          <div className="mb-4 flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <HugeiconsIcon icon={AlertCircleIcon} size={20} className="text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-900">
              {t('unassignedCategoriesPrompt', { count: unassignedExpenseCategories.length })}
              {' '}
              {t('assignBucketsToTrack')}
            </p>
          </div>
        )}

        {expenseCategories.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noExpenseCategoriesYet')}</p>
        ) : (
          <div className="space-y-3">
            {expenseCategories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="income" className="mt-0">
        <div className="mb-3 flex items-center justify-end">
          <AddCategoryButton type="income">{t('addIncomeCategory')}</AddCategoryButton>
        </div>
        {incomeCategories.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noIncomeCategoriesYet')}</p>
        ) : (
          <div className="space-y-3">
            {incomeCategories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
