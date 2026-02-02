import { getTranslations } from 'next-intl/server';
import { MonthPicker } from '@/components/month-picker';
import { getSafeToSpendData, getBudgetConfig } from '@/lib/actions/budget-503020';
import { getCurrentYearMonth } from '@/lib/utils';
import { PWARedirectHandler } from '@/components/pwa-redirect-handler';
import { OnboardingTooltip } from '@/components/onboarding/onboarding-tooltip';
import { PushNotificationPrompt } from '@/components/push-notification-prompt';
import { SafeToSpendHero } from '@/components/budget-503020/safe-to-spend-hero';
import { BucketOverview } from '@/components/budget-503020/bucket-overview';
import { PacingGauge } from '@/components/budget-503020/pacing-gauge';
import { PresetSelector } from '@/components/budget-503020/preset-selector';
import Link from 'next/link';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const t = await getTranslations('dashboard');
  const tOnboarding = await getTranslations('onboarding.hints');
  const tBudget503020 = await getTranslations('budget503020');
  const { month } = await searchParams;
  const currentMonth = month || getCurrentYearMonth();

  const [safeToSpendData, budgetConfig] = await Promise.all([
    getSafeToSpendData(currentMonth),
    getBudgetConfig(),
  ]);

  const currentPreset = budgetConfig?.preset ?? 'na_risca';
  const hasNoBudgets = safeToSpendData.totalBudget === 0;

  return (
    <div className="min-w-0">
      <PWARedirectHandler />

      <OnboardingTooltip hintKey="dashboard" className="mb-4">
        {tOnboarding('dashboard')}
      </OnboardingTooltip>

      <PushNotificationPrompt />

      <div className="mb-6 flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
        <h1 className="text-2xl font-bold hidden md:flex text-balance">{t('title')}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/statistics"
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            {tBudget503020('viewStatistics')}
          </Link>
          <PresetSelector currentPreset={currentPreset} />
          <MonthPicker currentMonth={currentMonth} />
        </div>
      </div>

      {hasNoBudgets ? (
        <div className="rounded-none border border-gray-200 p-12 text-center">
          <h2 className="mb-2 text-xl font-semibold text-balance">{t('noBudgets')}</h2>
          <p className="mb-6 text-gray-600">
            {t('noBudgetsDescription')}
          </p>
          <Link
            href="/settings/budgets"
            className="inline-block rounded-none bg-blue-600 px-6 py-3 text-sm text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t('setBudgets')}
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Safe to Spend Hero */}
          <SafeToSpendHero data={safeToSpendData} />

          {/* Bucket Overview */}
          <BucketOverview buckets={safeToSpendData.buckets} />

          {/* Pacing Gauge */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PacingGauge
              pacing={safeToSpendData.pacing}
              daysRemaining={safeToSpendData.daysRemaining}
            />

            {/* Placeholder for future widgets */}
            <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">
                  {tBudget503020('moreWidgetsSoon')}
                </p>
                <p className="text-xs text-gray-500">
                  {tBudget503020('personalizedInsights')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
