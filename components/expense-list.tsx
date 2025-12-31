'use client';

import { useExpenseContext, ExpenseListProvider } from '@/lib/contexts/expense-context';
import { ExpenseCard } from '@/components/expense-card';

export { ExpenseListProvider };

export function ExpenseList() {
  const { expenses, categories } = useExpenseContext();

  // Group by date (same logic as original page)
  const groupedByDate = expenses.reduce(
    (acc, expense) => {
      const date = expense.dueDate;
      if (!acc[date]) acc[date] = [];
      acc[date].push(expense);
      return acc;
    },
    {} as Record<string, typeof expenses>
  );

  const dates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  if (expenses.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">No expenses found for this period.</p>
        <p className="mt-2 text-sm text-gray-400">Use the + button to add an expense</p>
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
          <div className="space-y-3">
            {groupedByDate[date].map((expense) => (
              <ExpenseCard
                key={expense._tempId || expense.id}
                entry={expense}
                categories={categories}
                isOptimistic={expense._optimistic}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
