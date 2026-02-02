import { getTranslations } from 'next-intl/server';
import { MonthPicker } from '@/components/month-picker';
import { SummaryCard } from '@/components/summary-card';
import { UnbudgetedSpending } from '@/components/unbudgeted-spending';
import { CopyBudgetsButton } from '@/components/copy-budgets-button';
import { getBudgetsWithSpending } from '@/lib/actions/budgets';
import { getCurrentYearMonth } from '@/lib/utils';
import { OnboardingTooltip } from '@/components/onboarding/onboarding-tooltip';
import { BudgetBucketTabs } from '@/components/budget-bucket-tabs';
import { BudgetBucketView } from '@/components/budget-bucket-view';
import Link from 'next/link';
import type { BucketFilter } from '@/lib/hooks/use-bucket-filter';

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; bucket?: string }>
}) {
  const t = await getTranslations('budgets');
  const tOnboarding = await getTranslations('onboarding.hints');
  const params = await searchParams;
  const yearMonth = params.month || getCurrentYearMonth();
  const bucketFilter = (params.bucket || 'all') as BucketFilter;
  const data = await getBudgetsWithSpending(yearMonth);

  const hasNoBudgets = data.budgets.length === 0;

  return (
    <div>
      <OnboardingTooltip hintKey="budgets" className="mb-4">
          {tOnboarding('budgets')}
        </OnboardingTooltip>

        <div className="mb-6 flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
          <h1 className="text-2xl font-bold hidden md:flex text-balance">{t('title')}</h1>
          <MonthPicker currentMonth={yearMonth} />
        </div>

        {/* Bucket Tabs */}
        <BudgetBucketTabs />

        {/* Actions row */}
        <div className="mb-6 flex items-center justify-between">
          <CopyBudgetsButton currentMonth={yearMonth} />
          <Link
            href="/settings/budgets"
            className="text-sm text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t('editBudgets')}
          </Link>
        </div>

        {hasNoBudgets ? (
          <div className="rounded-none border border-gray-200 p-12 text-center">
            <h2 className="mb-2 text-xl font-semibold text-balance">{t('noBudgets')}</h2>
            <p className="mb-6 text-gray-600">
              {t('copyFrom')}
            </p>
            <div className="flex justify-center gap-4">
              <Link
                href="/settings/budgets"
                className="inline-block rounded-none bg-blue-600 px-6 py-3 text-sm text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {t('setBudgets')}
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Card - only show for "all" view */}
            {bucketFilter === 'all' && (
              <SummaryCard spent={data.totalSpent} replenished={data.totalReplenished} budget={data.totalBudget} />
            )}

            {/* Bucket-filtered Budget View */}
            <BudgetBucketView budgets={data.budgets} bucketFilter={bucketFilter} />

            {/* Unbudgeted Spending Section - only show for "all" view */}
            {bucketFilter === 'all' && data.unbudgeted.length > 0 && (
              <div>
                <h2 className="mb-4 text-lg font-semibold text-gray-600 text-balance">
                  {t('expensesWithoutBudget')}
                </h2>
                <div className="space-y-4">
                  {data.unbudgeted.map((item) => (
                    <UnbudgetedSpending
                      key={item.categoryId}
                      categoryName={item.categoryName}
                      categoryColor={item.categoryColor}
                      categoryIcon={item.categoryIcon}
                      spent={item.spent}
                      yearMonth={yearMonth}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
  );
}
