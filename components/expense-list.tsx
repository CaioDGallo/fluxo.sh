'use client';

import { useState, useEffect, useRef } from 'react';
import { useExpenseContext, ExpenseListProvider } from '@/lib/contexts/expense-context';
import { ExpenseCard } from '@/components/expense-card';
import { useSelection } from '@/lib/hooks/use-selection';
import { SelectionActionBar } from '@/components/selection-action-bar';
import { CategoryQuickPicker } from '@/components/category-quick-picker';
import { toast } from 'sonner';

export { ExpenseListProvider };

export function ExpenseList() {
  const context = useExpenseContext();
  const { expenses, categories, filters } = context;
  const selection = useSelection();
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);

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

  // Watch filter changes (clear selection when month changes)
  const prevYearMonthRef = useRef(filters.yearMonth);

  useEffect(() => {
    if (prevYearMonthRef.current !== filters.yearMonth) {
      selection.exitSelectionMode();
    }
    prevYearMonthRef.current = filters.yearMonth;
  }, [filters.yearMonth, selection]);

  // Bulk category handler
  const handleBulkCategoryChange = async (categoryId: number) => {
    setBulkPickerOpen(false);

    // Filter out optimistic items (negative IDs) and map entry.id -> transactionId
    const realTransactionIds = Array.from(selection.selectedIds)
      .map((id) => {
        const entry = expenses.find((e) => e.id === id);
        return entry && entry.transactionId > 0 ? entry.transactionId : null;
      })
      .filter((id): id is number => id !== null);

    // Get unique transaction IDs
    const uniqueTransactionIds = [...new Set(realTransactionIds)];

    if (uniqueTransactionIds.length === 0) {
      toast.error('Cannot update pending items');
      return;
    }

    await context.bulkUpdateCategory(uniqueTransactionIds, categoryId);
    selection.exitSelectionMode();
  };

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
                isSelected={selection.isSelected(expense.id)}
                isSelectionMode={selection.isSelectionMode}
                onLongPress={() => selection.enterSelectionMode(expense.id)}
                onToggleSelection={() => selection.toggleSelection(expense.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Selection action bar */}
      {selection.isSelectionMode && (
        <SelectionActionBar
          selectedCount={selection.selectedCount}
          onChangeCategory={() => setBulkPickerOpen(true)}
          onCancel={selection.exitSelectionMode}
        />
      )}

      {/* Bulk category picker */}
      <CategoryQuickPicker
        categories={categories}
        currentCategoryId={0}
        open={bulkPickerOpen}
        onOpenChange={setBulkPickerOpen}
        onSelect={handleBulkCategoryChange}
      />
    </div>
  );
}
