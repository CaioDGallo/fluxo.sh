'use client';

import { useIncomeContext, IncomeListProvider } from '@/lib/contexts/income-context';
import { IncomeCard } from '@/components/income-card';

export { IncomeListProvider };

export function IncomeList() {
  const { income, categories } = useIncomeContext();

  // Group by date (same logic as original page)
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

  if (income.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">No income found for this period.</p>
        <p className="mt-2 text-sm text-gray-400">Use the + button to add income</p>
      </div>
    );
  }

  return (
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
              <IncomeCard
                key={inc._tempId || inc.id}
                income={inc}
                categories={categories}
                isOptimistic={inc._optimistic}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
