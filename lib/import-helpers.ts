/**
 * Helper functions for import operations.
 * These are extracted from import.ts to allow testing without async requirements
 * (import.ts has "use server" directive).
 */

import type { ValidatedImportRow } from '@/lib/import/types';
import { getFaturaMonth, getFaturaPaymentDueDate, getFaturaMonthFromClosingDate, computeFaturaWindowStart } from '@/lib/fatura-utils';

export type AccountInfo = {
  type: string;
  closingDay: number | null;
  paymentDueDay: number | null;
};

export type EntryDateInfo = {
  purchaseDate: string; // YYYY-MM-DD
  faturaMonth: string; // YYYY-MM
  dueDate: string; // YYYY-MM-DD
};

/**
 * Calculate entry dates for a given installment.
 * Determines the purchaseDate, faturaMonth, and dueDate based on the account type and billing config.
 *
 * @param basePurchaseDate - Base purchase date in YYYY-MM-DD format (from first installment)
 * @param installmentNumber - Current installment number (1-based)
 * @param account - Account information with billing configuration
 * @param ofxClosingDate - Optional OFX closing date in YYYY-MM-DD format (for first installment fatura month)
 * @param overrideBaseFaturaMonth - Optional base fatura month to use instead of calculating from dates
 * @returns Entry dates (purchaseDate, faturaMonth, dueDate)
 */
export function computeEntryDates(
  basePurchaseDate: string,
  installmentNumber: number,
  account: AccountInfo,
  ofxClosingDate?: string,
  overrideBaseFaturaMonth?: string
): EntryDateInfo {
  const baseDate = new Date(basePurchaseDate + 'T00:00:00Z');

  const hasBillingConfig =
    account.type === 'credit_card' && account.closingDay && account.paymentDueDay;

  if (hasBillingConfig) {
    // Calculate base fatura month from the original purchase date
    let baseFaturaMonth: string;
    if (overrideBaseFaturaMonth) {
      // Use provided base fatura month (already calculated correctly for historic installments)
      baseFaturaMonth = overrideBaseFaturaMonth;
    } else if (ofxClosingDate) {
      const closingDate = new Date(ofxClosingDate + 'T00:00:00Z');
      baseFaturaMonth = getFaturaMonthFromClosingDate(baseDate, closingDate);
    } else {
      baseFaturaMonth = getFaturaMonth(baseDate, account.closingDay!);
    }

    // Calculate the fatura month for this installment
    const faturaMonth = addMonths(baseFaturaMonth, installmentNumber - 1);
    const dueDate = getFaturaPaymentDueDate(faturaMonth, account.paymentDueDay!, account.closingDay!);

    let purchaseDate: string;
    if (installmentNumber === 1) {
      // First installment: use actual purchase date
      purchaseDate = basePurchaseDate;
    } else {
      // Subsequent installments: use fatura window start date
      // This places them at the first day of their respective billing period
      purchaseDate = computeFaturaWindowStart(faturaMonth, account.closingDay!);
    }

    return { purchaseDate, faturaMonth, dueDate };
  }

  // Fallback for non-CC accounts: increment months on purchase date
  const installmentDate = new Date(baseDate);
  installmentDate.setUTCMonth(installmentDate.getUTCMonth() + (installmentNumber - 1));
  const purchaseDate = installmentDate.toISOString().split('T')[0];

  return {
    purchaseDate,
    faturaMonth: purchaseDate.slice(0, 7),
    dueDate: purchaseDate,
  };
}

/**
 * Helper: Calculate base purchase date from imported rows.
 * Works backwards from the earliest installment to determine when the first installment occurred.
 *
 * @param rows - Array of import rows with installment info
 * @param dateOffset - If true, subtract 1 day from the base date (for credit card async processing)
 * @returns Base purchase date in YYYY-MM-DD format
 */
export function calculateBasePurchaseDate(rows: ValidatedImportRow[], dateOffset?: boolean): string {
  // Find earliest installment in import
  const earliest = rows.reduce((min, r) =>
    r.installmentInfo!.current < min.installmentInfo!.current ? r : min,
    rows[0]
  );

  const info = earliest.installmentInfo!;
  const importedDate = new Date(earliest.date + 'T00:00:00Z');

  // Work backwards: Parcela 3 date - 2 months = Parcela 1 date
  const baseDate = new Date(importedDate);
  baseDate.setUTCMonth(baseDate.getUTCMonth() - (info.current - 1));

  // Apply date offset only if the earliest imported installment is the first one
  // This prevents offsetting subsequent installments which are placed on fatura window starts
  if (dateOffset && info.current === 1) {
    baseDate.setUTCDate(baseDate.getUTCDate() - 1);
  }

  return baseDate.toISOString().split('T')[0];
}

/**
 * Helper: Add months to a YYYY-MM string
 */
function addMonths(yearMonth: string, monthsToAdd: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + monthsToAdd);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
