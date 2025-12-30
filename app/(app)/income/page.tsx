import { getIncome, type IncomeFilters as IncomeFiltersType } from '@/lib/actions/income';
import { getAccounts } from '@/lib/actions/accounts';
import { getCategories } from '@/lib/actions/categories';
import { IncomeCard } from '@/components/income-card';
import { IncomeFilters } from '@/components/income-filters';
import { getCurrentYearMonth } from '@/lib/utils';

type PageProps = {
  searchParams: Promise<{
    month?: string;
    category?: string;
    account?: string;
    status?: 'pending' | 'received' | 'all';
  }>;
};

export default async function IncomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const currentMonth = params.month || getCurrentYearMonth();

  const filters: IncomeFiltersType = {
    yearMonth: currentMonth,
    categoryId: params.category ? parseInt(params.category) : undefined,
    accountId: params.account ? parseInt(params.account) : undefined,
    status: params.status || 'all',
  };

  const [income, accounts, categories] = await Promise.all([
    getIncome(filters),
    getAccounts(),
    getCategories('income'),
  ]);

  // Group income by date
  const groupedByDate = income.reduce(
    (acc, inc) => {
      const date = inc.receivedDate;
      if (!acc[date]) acc[date] = [];
      acc[date].push(inc);
      return acc;
    },
    {} as Record<string, typeof income>
  );

  const dates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Income</h1>
      </div>

      <IncomeFilters
        accounts={accounts}
        categories={categories}
        currentMonth={currentMonth}
      />

      {income.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-gray-500">No income found for this period.</p>
          <p className="mt-2 text-sm text-gray-400">
            Use the + button to add income
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {dates.map((date) => (
            <div key={date}>
              <h2 className="mb-3 text-sm font-medium text-gray-500">
                {new Date(date).toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </h2>
              <div className="space-y-2">
                {groupedByDate[date].map((inc) => (
                  <IncomeCard key={inc.id} income={inc} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
