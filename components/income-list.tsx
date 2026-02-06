'use client';

import { CategoryQuickPicker } from '@/components/category-quick-picker';
import { IncomeCard } from '@/components/income-card';
import { SelectionActionBar } from '@/components/selection-action-bar';
import { IncomeListProvider, useIncomeContext } from '@/lib/contexts/income-context';
import { useSelection } from '@/lib/hooks/use-selection';
import { formatDate } from '@/lib/utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { flattenGroupedData } from '@/lib/utils/flatten-grouped-data';
import { useVirtualizedGroupedList } from '@/lib/hooks/use-virtualized-grouped-list';
import { useTranslations } from 'next-intl';

export { IncomeListProvider };

export function IncomeList() {
  const t = useTranslations('income');
  const tCommon = useTranslations('common');
  const context = useIncomeContext();
  const { filteredIncome, accounts, recentAccounts, categories, recentCategories, filters, searchQuery } = context;
  const selection = useSelection();
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Group by date (same logic as original page)
  const groupedByDate = filteredIncome.reduce(
    (acc, inc) => {
      const date = inc.receivedDate;
      if (!acc[date]) acc[date] = [];
      acc[date].push(inc);
      return acc;
    },
    {} as Record<string, typeof filteredIncome>
  );

  const dates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  // Flatten for virtualization (only computed when filters change)
  const flatRows = useMemo(
    () => flattenGroupedData(groupedByDate, dates),
    [groupedByDate, dates]
  );

  // Conditional virtualization (only for large lists)
  const { listRef, virtualizer, shouldVirtualize } = useVirtualizedGroupedList(flatRows);

  // Watch filter changes (clear selection when month changes)
  const prevYearMonthRef = useRef(filters.yearMonth);
  const { exitSelectionMode } = selection;

  useEffect(() => {
    if (prevYearMonthRef.current !== filters.yearMonth) {
      exitSelectionMode();
    }
    prevYearMonthRef.current = filters.yearMonth;
  }, [filters.yearMonth, exitSelectionMode]);

  // Bulk category handler
  const handleBulkCategoryChange = async (categoryId: number) => {
    setBulkPickerOpen(false);

    // Filter out optimistic items (negative IDs)
    const realIncomeIds = selection.getSelectedIds().filter((id) => id > 0);

    if (realIncomeIds.length === 0) {
      toast.error(t('cannotUpdatePendingItems'));
      return;
    }

    setIsBulkUpdating(true);
    try {
      await context.bulkUpdateCategory(realIncomeIds, categoryId);
      toast.success(t('updatedItems'));
      selection.exitSelectionMode();
    } catch (error) {
      console.error('Bulk update failed:', error);
      if (error instanceof Error && error.message === 'Category not found') {
        toast.error(t('categoryNotFoundRefresh'));
      } else {
        toast.error(t('failedUpdateCategories'));
      }
      // Keep selection active so user can retry
    } finally {
      setIsBulkUpdating(false);
    }
  };

  if (filteredIncome.length === 0) {
    // Show different message when searching vs no data
    if (searchQuery.trim()) {
      return (
        <div className="py-12 text-center">
          <p className="text-gray-500">No income found matching &ldquo;{searchQuery}&rdquo;</p>
          <p className="mt-2 text-sm text-gray-400">Try a different search term</p>
        </div>
      );
    }
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">No income found for this period.</p>
        <p className="mt-2 text-sm text-gray-400">Use the + button to add income</p>
      </div>
    );
  }

  // Helper to render an income card
  const renderIncomeCard = (inc: typeof filteredIncome[number]) =>
    selection.isSelectionMode ? (
      <IncomeCard
        key={inc._tempId || inc.id}
        income={inc}
        categories={categories}
        accounts={accounts}
        recentAccounts={recentAccounts}
        recentCategories={recentCategories}
        isOptimistic={!!inc._optimistic}
        selectionMode={true}
        isSelected={selection.isSelected(inc.id)}
        onLongPress={() => selection.enterSelectionMode(inc.id)}
        onToggleSelection={() => selection.toggleSelection(inc.id)}
      />
    ) : (
      <IncomeCard
        key={inc._tempId || inc.id}
        income={inc}
        categories={categories}
        accounts={accounts}
        recentAccounts={recentAccounts}
        recentCategories={recentCategories}
        isOptimistic={!!inc._optimistic}
        selectionMode={false}
        onLongPress={() => selection.enterSelectionMode(inc.id)}
      />
    );

  return (
    <div className="space-y-4">
      {/* List wrapper with interaction blocking */}
      <div className={isBulkUpdating ? 'pointer-events-none opacity-60' : ''}>
        {!shouldVirtualize ? (
          // Small lists: render normally (exact current behavior)
          dates.map((date) => (
          <div key={date}>
            <h2 className="mb-2 text-sm font-medium text-gray-500">
              {formatDate(date, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </h2>
            <div className="space-y-1">{groupedByDate[date].map(renderIncomeCard)}</div>
          </div>
        ))
      ) : (
        // Large lists: use virtualization
        <div ref={listRef} style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = flatRows[virtualRow.index];
            if (!row) return null;

            return (
              <div
                key={virtualRow.index}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.type === 'header' ? (
                  <h2 className="mb-2 text-sm font-medium text-gray-500">
                    {formatDate(row.date, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h2>
                ) : (
                  renderIncomeCard(row.data)
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Selection action bar */}
      {selection.isSelectionMode && (
        <SelectionActionBar
          selectedCount={selection.selectedCount}
          onChangeCategory={() => setBulkPickerOpen(true)}
          onCancel={selection.exitSelectionMode}
          isUpdating={isBulkUpdating}
          changeCategoryLabel={t('changeCategory')}
          cancelLabel={tCommon('cancel')}
          selectedLabel={t('selected')}
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
