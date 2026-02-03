import { getTranslations } from 'next-intl/server';
import { getAccounts } from '@/lib/actions/accounts';
import { getFaturasByMonth } from '@/lib/actions/faturas';
import { getCurrentYearMonth } from '@/lib/utils';
import { MonthPicker } from '@/components/month-picker';
import { FaturaList } from '@/components/fatura-list';
import { FaturaTotalSummary } from '@/components/fatura-total-summary';
import { OnboardingTooltip } from '@/components/onboarding/onboarding-tooltip';

export default async function FaturasPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const t = await getTranslations('faturas');
  const tOnboarding = await getTranslations('onboarding.hints');
  const { month } = await searchParams;

  // Faturas page defaults to next month if no month specified
  const yearMonth = month || getCurrentYearMonth(true);

  const [faturas, accounts] = await Promise.all([
    getFaturasByMonth(yearMonth),
    getAccounts(),
  ]);

  // Exclude pluggy-synced accounts from payment source — sync handles those automatically
  const checkingAccounts = accounts.filter(a => a.type !== 'credit_card' && a.source !== 'pluggy');
  const syncedAccountIds = accounts.filter(a => a.source === 'pluggy').map(a => a.id);

  // Calculate totals for summary
  const now = new Date();
  const totalAmount = faturas.reduce((sum, f) => sum + f.totalAmount, 0);

  const paid = faturas.filter(f => f.paidAt !== null);
  const overdue = faturas.filter(f => !f.paidAt && new Date(f.dueDate) < now);
  const pending = faturas.filter(f => !f.paidAt && new Date(f.dueDate) >= now);

  const paidAmount = paid.reduce((sum, f) => sum + f.totalAmount, 0);
  const overdueAmount = overdue.reduce((sum, f) => sum + f.totalAmount, 0);
  const pendingAmount = pending.reduce((sum, f) => sum + f.totalAmount, 0);

  return (
    <div>
      <OnboardingTooltip hintKey="faturas" className="mb-4">
          {tOnboarding('faturas')}
        </OnboardingTooltip>

        <div className="mb-6 flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
          <h1 className="text-2xl font-bold hidden md:flex">{t('title')}</h1>
          <MonthPicker currentMonth={yearMonth} />
        </div>

        {faturas.length > 0 && (
          <div className="mb-6">
            <FaturaTotalSummary
              totalAmount={totalAmount}
              paidAmount={paidAmount}
              paidCount={paid.length}
              pendingAmount={pendingAmount}
              pendingCount={pending.length}
              overdueAmount={overdueAmount}
              overdueCount={overdue.length}
            />
          </div>
        )}

        <FaturaList
          faturas={faturas}
          checkingAccounts={checkingAccounts}
          syncedAccountIds={syncedAccountIds}
        />
      </div>
  );
}
