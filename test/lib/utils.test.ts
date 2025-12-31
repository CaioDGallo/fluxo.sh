import { describe, it, expect } from 'vitest';
import {
  centsToDisplay,
  displayToCents,
  formatCurrency,
  getCurrentYearMonth,
  parseYearMonth,
  addMonths,
} from '@/lib/utils';

describe('Money Utilities', () => {
  describe('centsToDisplay', () => {
    it('converts cents to display string', () => {
      expect(centsToDisplay(10050)).toBe('100.50');
      expect(centsToDisplay(100)).toBe('1.00');
      expect(centsToDisplay(1)).toBe('0.01');
      expect(centsToDisplay(0)).toBe('0.00');
    });

    it('handles negative values', () => {
      expect(centsToDisplay(-5000)).toBe('-50.00');
    });

    it('handles large values', () => {
      expect(centsToDisplay(999999999)).toBe('9999999.99');
    });
  });

  describe('displayToCents', () => {
    it('converts display string to cents', () => {
      expect(displayToCents('100.50')).toBe(10050);
      expect(displayToCents('1.00')).toBe(100);
      expect(displayToCents('0.01')).toBe(1);
      expect(displayToCents('0')).toBe(0);
    });

    it('rounds floating point correctly', () => {
      expect(displayToCents('0.30')).toBe(30);
      expect(displayToCents('100.99')).toBe(10099);
    });
  });

  describe('formatCurrency', () => {
    it('formats cents as BRL', () => {
      // Note: Uses non-breaking space (\u00A0) between R$ and amount
      expect(formatCurrency(10050)).toBe('R$\u00A0100,50');
      expect(formatCurrency(100000)).toBe('R$\u00A01.000,00');
      expect(formatCurrency(1)).toBe('R$\u00A00,01');
    });

    it('handles large values with thousand separators', () => {
      expect(formatCurrency(100000000)).toBe('R$\u00A01.000.000,00');
    });
  });
});

describe('Date Utilities', () => {
  describe('getCurrentYearMonth', () => {
    it('returns current year-month in YYYY-MM format', () => {
      const result = getCurrentYearMonth();
      expect(result).toMatch(/^\d{4}-\d{2}$/);
    });
  });

  describe('parseYearMonth', () => {
    it('parses year-month to Date', () => {
      const result = parseYearMonth('2025-01');
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // January = 0
      expect(result.getDate()).toBe(1);
    });
  });

  describe('addMonths', () => {
    it('adds months correctly', () => {
      expect(addMonths('2025-01', 1)).toBe('2025-02');
      expect(addMonths('2025-01', 12)).toBe('2026-01');
      expect(addMonths('2025-12', 1)).toBe('2026-01');
    });

    it('subtracts months correctly', () => {
      expect(addMonths('2025-02', -1)).toBe('2025-01');
      expect(addMonths('2026-01', -12)).toBe('2025-01');
      expect(addMonths('2025-01', -1)).toBe('2024-12');
    });

    it('handles zero months', () => {
      expect(addMonths('2025-05', 0)).toBe('2025-05');
    });
  });
});
