import { getFaturasByMonth } from '@/lib/actions/faturas';
import { getAccounts } from '@/lib/actions/accounts';
import { getCurrentYearMonth } from '@/lib/utils';
import { MonthPicker } from '@/components/month-picker';
import { FaturaList } from '@/components/fatura-list';

type PageProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function FaturasPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const yearMonth = params.month || getCurrentYearMonth();

  const faturas = await getFaturasByMonth(yearMonth);
  const accounts = await getAccounts();
  const checkingAccounts = accounts.filter(a => a.type !== 'credit_card');

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
        <h1 className="text-2xl font-bold">Faturas</h1>
        <MonthPicker currentMonth={yearMonth} />
      </div>

      <FaturaList
        faturas={faturas}
        checkingAccounts={checkingAccounts}
      />
    </div>
  );
}
