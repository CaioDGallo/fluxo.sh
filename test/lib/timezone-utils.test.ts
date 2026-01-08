import 'temporal-polyfill/global';
import { describe, it, expect } from 'vitest';
import { resolveTimeZone, toZonedDateTime } from '@/lib/timezone-utils';

describe('timezone-utils', () => {
  describe('resolveTimeZone', () => {
    it('falls back to browser timezone when settings missing', () => {
      expect(resolveTimeZone(undefined, 'America/Sao_Paulo')).toBe('America/Sao_Paulo');
      expect(resolveTimeZone(null, 'UTC')).toBe('UTC');
    });

    it('prefers browser timezone when settings is UTC but browser is not', () => {
      expect(resolveTimeZone({ timezone: 'UTC' }, 'America/New_York')).toBe('America/New_York');
    });

    it('uses settings timezone when provided', () => {
      expect(resolveTimeZone({ timezone: 'Europe/Lisbon' }, 'America/New_York')).toBe('Europe/Lisbon');
    });
  });

  describe('toZonedDateTime', () => {
    it('preserves the instant when converting to UTC', () => {
      const date = new Date('2026-05-01T12:34:00Z');
      const zoned = toZonedDateTime(date, 'UTC');
      expect(zoned.epochMilliseconds).toBe(date.getTime());
      expect(zoned.timeZoneId).toBe('UTC');
    });

    it('handles DST transitions for recurring task times', () => {
      const before = toZonedDateTime(new Date('2026-03-08T06:30:00Z'), 'America/New_York');
      const after = toZonedDateTime(new Date('2026-03-08T07:30:00Z'), 'America/New_York');

      expect(before.offset).toBe('-05:00');
      expect(after.offset).toBe('-04:00');
      expect(before.hour).toBe(1);
      expect(after.hour).toBe(3);
    });
  });
});
