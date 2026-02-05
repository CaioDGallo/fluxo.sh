import { useRef } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import type { VirtualRow } from '@/lib/utils/flatten-grouped-data';

/**
 * Height constants for virtual list items
 * Adjust these based on actual component heights
 */
const HEADER_HEIGHT = 44; // Date header height in px
const ITEM_HEIGHT = 80; // Expense/Income card height in px
const VIRTUALIZATION_THRESHOLD = 50; // Only virtualize if more than 50 items

/**
 * Shared hook for virtualizing grouped lists (expenses, income)
 * Uses window scroll and conditional virtualization based on list size
 *
 * @param flatRows - Flattened array of header and item rows
 * @returns Virtualization props and state
 */
export function useVirtualizedGroupedList<T>(flatRows: VirtualRow<T>[]) {
  const listRef = useRef<HTMLDivElement>(null);
  const shouldVirtualize = flatRows.length > VIRTUALIZATION_THRESHOLD;

  const virtualizer = useWindowVirtualizer({
    count: flatRows.length,
    estimateSize: (index) => {
      const row = flatRows[index];
      return row?.type === 'header' ? HEADER_HEIGHT : ITEM_HEIGHT;
    },
    overscan: 8, // Render 8 extra items above/below viewport for smooth scrolling
    enabled: shouldVirtualize,
    // Use measureElement for dynamic height correction (more accurate than estimateSize)
    measureElement:
      typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
  });

  return {
    listRef,
    virtualizer,
    shouldVirtualize,
  };
}
