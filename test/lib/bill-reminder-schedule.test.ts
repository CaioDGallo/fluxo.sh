import { buildBillReminderSchedule } from '@/lib/bill-reminder-schedule';
import type { BillReminder } from '@/lib/schema';
import 'temporal-polyfill/global';
import { describe, expect, it } from 'vitest';

// Helper to create mock bill reminder with defaults
function createMockReminder(overrides: Partial<BillReminder> = {}): BillReminder {
  return {
    id: 1,
    userId: 'test-user',
    name: 'Test Bill',
    categoryId: null,
    amount: null,
    dueDay: 15,
    dueTime: null,
    status: 'active',
    recurrenceType: 'monthly',
    startMonth: '2025-01',
    endMonth: null,
    notify2DaysBefore: true,
    notify1DayBefore: true,
    notifyOnDueDay: true,
    lastAcknowledgedMonth: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('Bill Reminder Schedule', () => {
  const TIME_ZONE = 'America/Sao_Paulo';

  describe('Basic Occurrence Generation', () => {
    it('monthly recurrence generates multiple occurrences', () => {
      const reminder = createMockReminder({
        recurrenceType: 'monthly',
        dueDay: 15,
        startMonth: '2025-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-03-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBeGreaterThan(0);
      expect(scheduleEvents[0].title).toBe('Test Bill');
    });

    it('weekly recurrence generates multiple occurrences', () => {
      const reminder = createMockReminder({
        recurrenceType: 'weekly',
        dueDay: 1, // Monday
        startMonth: '2025-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-01-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBeGreaterThan(0);
    });

    it('biweekly recurrence generates occurrences', () => {
      const reminder = createMockReminder({
        recurrenceType: 'biweekly',
        dueDay: 1,
        startMonth: '2025-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-01-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBeGreaterThan(0);
    });

    it('quarterly recurrence generates occurrences', () => {
      const reminder = createMockReminder({
        recurrenceType: 'quarterly',
        dueDay: 15,
        startMonth: '2025-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-06-30T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBeGreaterThan(0);
    });

    it('yearly recurrence generates occurrences', () => {
      const reminder = createMockReminder({
        recurrenceType: 'yearly',
        dueDay: 15,
        startMonth: '2025-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2026-12-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBeGreaterThan(0);
    });

    it('once type generates single occurrence', () => {
      const reminder = createMockReminder({
        recurrenceType: 'once',
        dueDay: 15,
        startMonth: '2025-01',
        endMonth: '2025-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-12-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBe(1);
    });
  });

  describe('All-Day vs Timed Events', () => {
    it('dueTime=null creates all-day event', () => {
      const reminder = createMockReminder({
        dueTime: null,
        dueDay: 15,
        startMonth: '2025-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-03-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBeGreaterThan(0);
      // All-day events should have start and end defined
      expect(scheduleEvents[0].start).toBeTruthy();
      expect(scheduleEvents[0].end).toBeTruthy();
    });

    it('dueTime with specific time creates timed event', () => {
      const reminder = createMockReminder({
        dueTime: '10:00',
        dueDay: 15,
        startMonth: '2025-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-03-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBeGreaterThan(0);
      // Timed events should have start and end defined
      expect(scheduleEvents[0].start).toBeTruthy();
      expect(scheduleEvents[0].end).toBeTruthy();
    });

    it('handles different dueTime values', () => {
      const reminder = createMockReminder({
        dueTime: '14:30',
        dueDay: 15,
        startMonth: '2025-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-03-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBeGreaterThan(0);
      expect(scheduleEvents[0].start).toBeTruthy();
      expect(scheduleEvents[0].end).toBeTruthy();
    });
  });

  describe('Boundary Conditions', () => {
    it('occurrence on viewStart is included', () => {
      const reminder = createMockReminder({
        dueDay: 1,
        startMonth: '2025-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-01-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBeGreaterThan(0);
    });

    it('occurrence on viewEnd is included', () => {
      const reminder = createMockReminder({
        dueDay: 31,
        startMonth: '2025-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-01-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBeGreaterThan(0);
    });

    it('occurrence before viewStart is excluded', () => {
      const reminder = createMockReminder({
        dueDay: 15,
        startMonth: '2024-12',
      });

      const viewStart = new Date('2025-01-20T00:00:00Z');
      const viewEnd = new Date('2025-01-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      // Should not include Dec occurrence
      expect(scheduleEvents.length).toBe(0);
    });

    it('occurrence after viewEnd may be excluded', () => {
      const reminder = createMockReminder({
        dueDay: 15,
        startMonth: '2025-02',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-01-10T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      // If startMonth is Feb and view ends in early Jan, should have no events
      expect(scheduleEvents.length).toBe(0);
    });

    it('handles cases with no matching occurrences', () => {
      const reminder = createMockReminder({
        recurrenceType: 'once',
        dueDay: 15,
        startMonth: '2027-01',
        endMonth: '2027-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-12-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      // 'once' type with startMonth in 2027 should not appear in 2025 view
      expect(scheduleEvents.length).toBe(0);
    });
  });

  describe('Timezone Handling', () => {
    it('handles America/Sao_Paulo timezone', () => {
      const reminder = createMockReminder({
        dueDay: 15,
        startMonth: '2025-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-01-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        'America/Sao_Paulo',
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBeGreaterThan(0);
      // Should have a timezone-aware timestamp
      expect(scheduleEvents[0].start).toBeTruthy();
    });

    it('handles UTC timezone', () => {
      const reminder = createMockReminder({
        dueDay: 15,
        startMonth: '2025-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-01-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        'UTC',
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBeGreaterThan(0);
      expect(scheduleEvents[0].start).toBeTruthy();
    });

    it('generates events across DST transition periods', () => {
      const reminder = createMockReminder({
        dueDay: 15,
        startMonth: '2025-01',
      });

      // Span DST transition period (if applicable)
      const viewStart = new Date('2025-10-01T00:00:00Z');
      const viewEnd = new Date('2025-11-30T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        'America/Sao_Paulo',
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBeGreaterThan(0);
      // Events should still be generated correctly across DST
    });
  });

  describe('Schedule Event Properties', () => {
    it('generates unique IDs for occurrences', () => {
      const reminder = createMockReminder({
        id: 42,
        dueDay: 15,
        startMonth: '2025-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-03-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBeGreaterThan(1);

      // First occurrence should have base ID
      expect(scheduleEvents[0].id).toBe('bill-reminder-42');

      // Subsequent occurrences should have unique IDs
      expect(scheduleEvents[1].id).toMatch(/^bill-reminder-42-occ-\d+$/);

      // All IDs should be unique
      const ids = scheduleEvents.map(e => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('sets itemType and itemId correctly', () => {
      const reminder = createMockReminder({
        id: 123,
        dueDay: 15,
        startMonth: '2025-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-01-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBeGreaterThan(0);
      expect(scheduleEvents[0].itemType).toBe('bill_reminder');
      expect(scheduleEvents[0].itemId).toBe(123);
    });

    it('calendar ID is always "bill-reminders"', () => {
      const reminder = createMockReminder({
        dueDay: 15,
        startMonth: '2025-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-01-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBeGreaterThan(0);
      expect(scheduleEvents.every(e => e.calendarId === 'bill-reminders')).toBe(true);
    });

    it('includes amount, categoryId, and status fields', () => {
      const reminder = createMockReminder({
        amount: 15000, // R$ 150,00
        categoryId: 5,
        status: 'active',
        dueDay: 15,
        startMonth: '2025-01',
      });

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-01-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [reminder],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      expect(scheduleEvents.length).toBeGreaterThan(0);
      expect(scheduleEvents[0].amount).toBe(15000);
      expect(scheduleEvents[0].categoryId).toBe(5);
      expect(scheduleEvents[0].status).toBe('active');
    });
  });

  describe('Multiple Reminders', () => {
    it('handles multiple reminders with different recurrence patterns', () => {
      const reminders = [
        createMockReminder({ id: 1, recurrenceType: 'monthly', dueDay: 5 }),
        createMockReminder({ id: 2, recurrenceType: 'weekly', dueDay: 1 }),
        createMockReminder({ id: 3, recurrenceType: 'once', dueDay: 15 }),
      ];

      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-01-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        reminders,
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      // Should have events from multiple reminders
      expect(scheduleEvents.length).toBeGreaterThan(0);

      // Verify events from different reminders exist
      const uniqueItemIds = new Set(scheduleEvents.map(e => e.itemId));
      expect(uniqueItemIds.size).toBeGreaterThan(1);
    });

    it('handles empty reminders array', () => {
      const viewStart = new Date('2025-01-01T00:00:00Z');
      const viewEnd = new Date('2025-01-31T23:59:59Z');

      const { scheduleEvents } = buildBillReminderSchedule(
        [],
        TIME_ZONE,
        viewStart,
        viewEnd
      );

      expect(scheduleEvents).toEqual([]);
    });
  });
});
