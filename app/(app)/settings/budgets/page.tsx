import { getTranslations } from 'next-intl/server';
import { getBudgetsForMonth, getMonthlyBudget } from '@/lib/actions/budgets';
import { getBudgetConfig } from '@/lib/actions/budget-503020';
import { BudgetForm } from '@/components/budget-form';
import { MonthPicker } from '@/components/month-picker';
import { getCurrentYearMonth } from '@/lib/utils';
import { OnboardingTooltip } from '@/components/onboarding/onboarding-tooltip';
import { CopyBudgetsButton } from '@/components/copy-budgets-button';
import { getBudgetPercentages } from '@/lib/budget-utils';

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const [{ month }, t, tOnboarding] = await Promise.all([
    searchParams,
    getTranslations('budgets'),
    getTranslations('onboarding.hints'),
  ]);
  const yearMonth = month || getCurrentYearMonth();

  const [budgets, monthlyBudget, config] = await Promise.all([
    getBudgetsForMonth(yearMonth),
    getMonthlyBudget(yearMonth),
    getBudgetConfig(),
  ]);

  const budgetPercentages = getBudgetPercentages(config);

  return (
    <div>
      <OnboardingTooltip hintKey="budgetsSettings" className="mb-4">
        {tOnboarding('budgetsSettings')}
      </OnboardingTooltip>
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
          <h1 className="text-2xl font-bold text-balance">{t('title')}</h1>
          <MonthPicker currentMonth={yearMonth} />
        </div>
        <CopyBudgetsButton currentMonth={yearMonth} />
      </div>

      <BudgetForm
        yearMonth={yearMonth}
        budgets={budgets}
        monthlyBudget={monthlyBudget}
        budgetConfig={budgetPercentages ?? undefined}
      />
    </div>
  );
}
