import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { MonthPicker } from '@/components/month-picker';
import { getSafeToSpendData, getBudgetConfig } from '@/lib/actions/budget-503020';
import { getCurrentYearMonth } from '@/lib/utils';
import { PWARedirectHandler } from '@/components/pwa-redirect-handler';
import { OnboardingTooltip } from '@/components/onboarding/onboarding-tooltip';
import { PushNotificationPrompt } from '@/components/push-notification-prompt';
import { SafeToSpendHero } from '@/components/budget-503020/safe-to-spend-hero';
import { BucketOverview } from '@/components/budget-503020/bucket-overview';
import { PacingGauge } from '@/components/budget-503020/pacing-gauge';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const t = await getTranslations('dashboard');
  const tOnboarding = await getTranslations('onboarding.hints');
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
        <MonthPicker currentMonth={currentMonth} />
      </div>

      {hasNoBudgets ? (
        <div className="rounded-none border border-border p-12 text-center">
          <h2 className="mb-2 text-xl font-semibold text-balance">{t('noBudgets')}</h2>
          <p className="mb-6 text-muted-foreground">
            {t('noBudgetsDescription')}
          </p>
          <Link
            href="/settings/budgets"
            className="inline-block rounded-none bg-primary px-6 py-3 text-sm text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {t('setBudgets')}
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Safe to Spend Hero */}
          <SafeToSpendHero data={safeToSpendData} currentPreset={currentPreset} />

          {/* Pacing Gauge */}
          <PacingGauge
            pacing={safeToSpendData.pacing}
            daysRemaining={safeToSpendData.daysRemaining}
          />

          {/* Bucket Overview */}
          <BucketOverview buckets={safeToSpendData.buckets} />
        </div>
      )}
    </div>
  );
}
