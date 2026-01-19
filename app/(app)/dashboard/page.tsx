'use client';

import { useTranslations } from 'next-intl';
import { MonthPicker } from '@/components/month-picker';
import { SummaryCard } from '@/components/summary-card';
import { BalanceSummary } from '@/components/balance-summary';
import { CashFlowReport } from '@/components/cash-flow-report';
import { BudgetProgress } from '@/components/budget-progress';
import { RecentExpenses } from '@/components/recent-expenses';
import { NetWorthSummary } from '@/components/net-worth-summary';
import { useMonthStore } from '@/lib/stores/month-store';
import { useDashboardData } from '@/lib/hooks/use-dashboard-data';
import { useNetWorth } from '@/lib/hooks/use-net-worth';
import { usePrefetchMonths } from '@/lib/hooks/use-prefetch-months';
import Link from 'next/link';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const currentMonth = useMonthStore((state) => state.currentMonth);
  const { data, loading } = useDashboardData(currentMonth);
  const { data: netWorth } = useNetWorth();

  // Prefetch adjacent months in background
  usePrefetchMonths('dashboard');

  if (loading || !data || !netWorth) {
    return (
      <div>
        <div className="mb-6 flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <MonthPicker pageType="dashboard" />
        </div>
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <div className="text-lg">{t('loading', { default: 'Carregando...' })}</div>
          </div>
        </div>
      </div>
    );
  }

  const hasNoBudgets = data.categoryBreakdown.length === 0;

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <MonthPicker pageType="dashboard" />
      </div>

      {hasNoBudgets ? (
        <div className="rounded-none border border-gray-200 p-12 text-center">
          <h2 className="mb-2 text-xl font-semibold">{t('noBudgets')}</h2>
          <p className="mb-6 text-gray-600">
            {t('noBudgetsDescription')}
          </p>
          <Link
            href="/settings/budgets"
            className="inline-block rounded-none bg-blue-600 px-6 py-3 text-sm text-white hover:bg-blue-700"
          >
            {t('setBudgets')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column - Summary */}
          <div className="space-y-6">
            <BalanceSummary
              income={data.totalIncome}
              expenses={data.totalSpent}
              netBalance={data.netBalance}
            />
            <NetWorthSummary
              totalAssets={netWorth.totalAssets}
              totalLiabilities={netWorth.totalLiabilities}
              netWorth={netWorth.netWorth}
              byType={netWorth.byType}
            />
            <CashFlowReport
              income={data.totalIncome}
              expenses={data.totalSpent}
              transfersIn={data.totalTransfersIn}
              transfersOut={data.totalTransfersOut}
              net={data.cashFlowNet}
            />
            <SummaryCard spent={data.totalSpent} replenished={data.totalReplenished} budget={data.totalBudget} />
            <RecentExpenses expenses={data.recentExpenses} />
          </div>

          {/* Right column - Category breakdown */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold">{t('budgetByCategory')}</h2>
            <div className="space-y-4">
              {data.categoryBreakdown.map((category) => (
                <BudgetProgress
                  key={category.categoryId}
                  categoryName={category.categoryName}
                  categoryColor={category.categoryColor}
                  categoryIcon={category.categoryIcon}
                  spent={category.spent}
                  replenished={category.replenished}
                  budget={category.budget}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
