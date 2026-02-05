/**
 * Utility to convert grouped data (by date) into a flat array for virtualization
 */

export type VirtualRow<T> =
  | { type: 'header'; date: string }
  | { type: 'item'; data: T };

/**
 * Flattens grouped data into a flat array of virtual rows
 * Used for list virtualization with grouped sections
 *
 * @param groupedByDate - Object mapping dates to arrays of items
 * @param sortedDates - Array of dates in display order
 * @returns Flat array with header and item rows
 */
export function flattenGroupedData<T>(
  groupedByDate: Record<string, T[]>,
  sortedDates: string[]
): VirtualRow<T>[] {
  const rows: VirtualRow<T>[] = [];

  for (const date of sortedDates) {
    const items = groupedByDate[date];
    if (!items || items.length === 0) continue;

    // Add date header row
    rows.push({ type: 'header', date });

    // Add item rows for this date
    for (const item of items) {
      rows.push({ type: 'item', data: item });
    }
  }

  return rows;
}
