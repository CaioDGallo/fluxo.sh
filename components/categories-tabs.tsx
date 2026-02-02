'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AddCategoryButton } from '@/components/add-category-button';
import { CategoryCard } from '@/components/category-card';
import { CategoryBucketGroup } from '@/components/category-bucket-group';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircleIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import type { Category } from '@/lib/schema';
import type { BucketType } from '@/lib/actions/budget-503020';

interface CategoriesTabsProps {
  expenseCategories: Category[];
  incomeCategories: Category[];
}

export function CategoriesTabs({ expenseCategories, incomeCategories }: CategoriesTabsProps) {
  const t = useTranslations('categories');

  // Group expense categories by bucket
  const { unassigned, necessities, wants, savings } = useMemo(() => {
    const groups = {
      unassigned: [] as Category[],
      necessities: [] as Category[],
      wants: [] as Category[],
      savings: [] as Category[],
    };

    expenseCategories.forEach((category) => {
      if (!category.bucket) {
        groups.unassigned.push(category);
      } else {
        groups[category.bucket as BucketType].push(category);
      }
    });

    return groups;
  }, [expenseCategories]);

  const hasAssignedCategories = necessities.length > 0 || wants.length > 0 || savings.length > 0;

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

        {expenseCategories.length === 0 ? (
          <p className="text-sm text-gray-500">{t('noExpenseCategoriesYet')}</p>
        ) : (
          <div className="space-y-3">
            {/* Unassigned categories section */}
            {unassigned.length > 0 && (
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                <CardContent className="flex gap-3 p-4">
                  <HugeiconsIcon
                    icon={AlertCircleIcon}
                    size={20}
                    className="text-amber-600 dark:text-amber-400 flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="text-sm text-amber-900 dark:text-amber-100 mb-2">
                      {t('unassignedCategoriesPrompt', { count: unassigned.length })}
                      {' '}
                      {t('assignBucketsToTrack')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Bucket groups */}
            {hasAssignedCategories && (
              <>
                <CategoryBucketGroup
                  bucket="necessities"
                  categories={necessities}
                  defaultOpen={true}
                />
                <CategoryBucketGroup
                  bucket="wants"
                  categories={wants}
                  defaultOpen={false}
                />
                <CategoryBucketGroup
                  bucket="savings"
                  categories={savings}
                  defaultOpen={false}
                />

                {/* Unassigned categories (flat list below buckets) */}
                {unassigned.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground px-1 pt-2">
                      {t('unassignedCategories')}
                    </h3>
                    {unassigned.map((category) => (
                      <CategoryCard key={category.id} category={category} />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Fallback: show all categories ungrouped if no buckets assigned */}
            {!hasAssignedCategories && unassigned.length > 0 && (
              <div className="space-y-3">
                {unassigned.map((category) => (
                  <CategoryCard key={category.id} category={category} />
                ))}
              </div>
            )}
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
