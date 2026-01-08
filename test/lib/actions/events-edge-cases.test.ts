import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID, createTestEvent } from '@/test/fixtures';
import { eq, and, or } from 'drizzle-orm';

type EventsActions = typeof import('@/lib/actions/events');

describe('Event Actions - Edge Cases and Error Handling', () => {
  let db: ReturnType<typeof getTestDb>;

  let createEvent: EventsActions['createEvent'];

  let getCurrentUserIdMock: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({
      db,
    }));

    getCurrentUserIdMock = vi.fn().mockResolvedValue(TEST_USER_ID);
    vi.doMock('@/lib/auth', () => ({
      getCurrentUserId: getCurrentUserIdMock,
    }));

    const eventActions = await import('@/lib/actions/events');
    createEvent = eventActions.createEvent;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  describe('Null Fields Handling', () => {
    it('accepts null for optional description field', async () => {
      const result = await createEvent({
        title: 'Event without description',
        startAt: new Date('2026-02-01T10:00:00Z'),
        endAt: new Date('2026-02-01T11:00:00Z'),
        description: undefined,
      });

      expect(result.success).toBe(true);

      const [event] = await db.select().from(schema.events);
      expect(event.description).toBeNull();
    });

    it('accepts null for optional location field', async () => {
      const result = await createEvent({
        title: 'Event without location',
        startAt: new Date('2026-02-01T10:00:00Z'),
        endAt: new Date('2026-02-01T11:00:00Z'),
        location: undefined,
      });

      expect(result.success).toBe(true);

      const [event] = await db.select().from(schema.events);
      expect(event.location).toBeNull();
    });

    it('accepts event with both description and location null', async () => {
      const result = await createEvent({
        title: 'Minimal Event',
        startAt: new Date('2026-02-01T10:00:00Z'),
        endAt: new Date('2026-02-01T11:00:00Z'),
      });

      expect(result.success).toBe(true);

      const [event] = await db.select().from(schema.events);
      expect(event.description).toBeNull();
      expect(event.location).toBeNull();
    });

    it('stores actual null in DB for optional fields when not provided', async () => {
      await db.insert(schema.events).values(
        createTestEvent({
          description: undefined,
          location: undefined,
        })
      );

      const [event] = await db.select().from(schema.events);
      expect(event.description).toBeNull();
      expect(event.location).toBeNull();
    });
  });

  describe('Database Constraints', () => {
    it('rejects event where endAt is before startAt (violates start_before_end constraint)', async () => {
      const result = await createEvent({
        title: 'Invalid Time Range',
        startAt: new Date('2026-02-01T11:00:00Z'),
        endAt: new Date('2026-02-01T10:00:00Z'), // Before startAt
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }

      // Verify no event was created
      const events = await db.select().from(schema.events);
      expect(events).toHaveLength(0);
    });

    it('rejects event where endAt equals startAt (violates start_before_end constraint)', async () => {
      const sameTime = new Date('2026-02-01T10:00:00Z');

      const result = await createEvent({
        title: 'Zero Duration Event',
        startAt: sameTime,
        endAt: sameTime, // Same as startAt
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }

      // Verify no event was created
      const events = await db.select().from(schema.events);
      expect(events).toHaveLength(0);
    });

    it('accepts event where endAt is 1 second after startAt (minimal valid duration)', async () => {
      const startAt = new Date('2026-02-01T10:00:00Z');
      const endAt = new Date('2026-02-01T10:00:01Z'); // 1 second later

      const result = await createEvent({
        title: 'Minimal Duration Event',
        startAt,
        endAt,
      });

      expect(result.success).toBe(true);

      const [event] = await db.select().from(schema.events);
      expect(event.startAt).toEqual(startAt);
      expect(event.endAt).toEqual(endAt);
    });

    it('validates constraint at DB level when inserting directly', async () => {
      await expect(
        db.insert(schema.events).values(
          createTestEvent({
            startAt: new Date('2026-02-01T11:00:00Z'),
            endAt: new Date('2026-02-01T10:00:00Z'),
          })
        )
      ).rejects.toThrow();
    });
  });

  describe('All-Day Events', () => {
    it('creates all-day event with isAllDay flag set to true', async () => {
      const result = await createEvent({
        title: 'All Day Meeting',
        startAt: new Date('2026-03-01T00:00:00Z'),
        endAt: new Date('2026-03-01T23:59:59Z'),
        isAllDay: true,
      });

      expect(result.success).toBe(true);

      const [event] = await db.select().from(schema.events);
      expect(event.isAllDay).toBe(true);
      expect(event.title).toBe('All Day Meeting');
    });

    it('defaults isAllDay to false when not specified', async () => {
      const result = await createEvent({
        title: 'Regular Event',
        startAt: new Date('2026-03-01T10:00:00Z'),
        endAt: new Date('2026-03-01T11:00:00Z'),
      });

      expect(result.success).toBe(true);

      const [event] = await db.select().from(schema.events);
      expect(event.isAllDay).toBe(false);
    });

    it('allows all-day events to span multiple days', async () => {
      const result = await createEvent({
        title: 'Multi-Day Conference',
        startAt: new Date('2026-03-01T00:00:00Z'),
        endAt: new Date('2026-03-03T23:59:59Z'), // 3 days
        isAllDay: true,
      });

      expect(result.success).toBe(true);

      const [event] = await db.select().from(schema.events);
      expect(event.isAllDay).toBe(true);
      expect(event.endAt.getTime() - event.startAt.getTime()).toBe(3 * 24 * 60 * 60 * 1000 - 1000);
    });

    it('allows all-day events with specific times (not just midnight)', async () => {
      const result = await createEvent({
        title: 'All Day with Times',
        startAt: new Date('2026-03-01T08:00:00Z'),
        endAt: new Date('2026-03-01T20:00:00Z'),
        isAllDay: true,
      });

      expect(result.success).toBe(true);

      const [event] = await db.select().from(schema.events);
      expect(event.isAllDay).toBe(true);
    });
  });

  describe('Priority and Status Filtering', () => {
    beforeEach(async () => {
      // Insert events with different priorities and statuses
      await db.insert(schema.events).values([
        createTestEvent({
          title: 'Critical Scheduled',
          priority: 'critical',
          status: 'scheduled',
        }),
        createTestEvent({
          title: 'High Scheduled',
          priority: 'high',
          status: 'scheduled',
        }),
        createTestEvent({
          title: 'Medium Completed',
          priority: 'medium',
          status: 'completed',
        }),
        createTestEvent({
          title: 'Low Cancelled',
          priority: 'low',
          status: 'cancelled',
        }),
        createTestEvent({
          title: 'Low Scheduled',
          priority: 'low',
          status: 'scheduled',
        }),
      ]);
    });

    it('filters events by priority - critical', async () => {
      const criticalEvents = await db
        .select()
        .from(schema.events)
        .where(and(
          eq(schema.events.userId, TEST_USER_ID),
          eq(schema.events.priority, 'critical')
        ));

      expect(criticalEvents).toHaveLength(1);
      expect(criticalEvents[0].title).toBe('Critical Scheduled');
    });

    it('filters events by priority - high', async () => {
      const highEvents = await db
        .select()
        .from(schema.events)
        .where(and(
          eq(schema.events.userId, TEST_USER_ID),
          eq(schema.events.priority, 'high')
        ));

      expect(highEvents).toHaveLength(1);
      expect(highEvents[0].title).toBe('High Scheduled');
    });

    it('filters events by priority - low', async () => {
      const lowEvents = await db
        .select()
        .from(schema.events)
        .where(and(
          eq(schema.events.userId, TEST_USER_ID),
          eq(schema.events.priority, 'low')
        ));

      expect(lowEvents).toHaveLength(2);
      expect(lowEvents.map((e) => e.title).sort()).toEqual([
        'Low Cancelled',
        'Low Scheduled',
      ]);
    });

    it('filters events by status - scheduled', async () => {
      const scheduledEvents = await db
        .select()
        .from(schema.events)
        .where(and(
          eq(schema.events.userId, TEST_USER_ID),
          eq(schema.events.status, 'scheduled')
        ));

      expect(scheduledEvents).toHaveLength(3);
      expect(scheduledEvents.map((e) => e.title).sort()).toEqual([
        'Critical Scheduled',
        'High Scheduled',
        'Low Scheduled',
      ]);
    });

    it('filters events by status - completed', async () => {
      const completedEvents = await db
        .select()
        .from(schema.events)
        .where(and(
          eq(schema.events.userId, TEST_USER_ID),
          eq(schema.events.status, 'completed')
        ));

      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0].title).toBe('Medium Completed');
    });

    it('filters events by status - cancelled', async () => {
      const cancelledEvents = await db
        .select()
        .from(schema.events)
        .where(and(
          eq(schema.events.userId, TEST_USER_ID),
          eq(schema.events.status, 'cancelled')
        ));

      expect(cancelledEvents).toHaveLength(1);
      expect(cancelledEvents[0].title).toBe('Low Cancelled');
    });

    it('filters events by combined priority and status', async () => {
      const filteredEvents = await db
        .select()
        .from(schema.events)
        .where(and(
          eq(schema.events.userId, TEST_USER_ID),
          eq(schema.events.priority, 'low'),
          eq(schema.events.status, 'scheduled')
        ));

      expect(filteredEvents).toHaveLength(1);
      expect(filteredEvents[0].title).toBe('Low Scheduled');
    });

    it('filters events by multiple priorities using OR', async () => {
      const highOrCriticalEvents = await db
        .select()
        .from(schema.events)
        .where(and(
          eq(schema.events.userId, TEST_USER_ID),
          or(
            eq(schema.events.priority, 'high'),
            eq(schema.events.priority, 'critical')
          )
        ));

      expect(highOrCriticalEvents).toHaveLength(2);
      expect(highOrCriticalEvents.map((e) => e.title).sort()).toEqual([
        'Critical Scheduled',
        'High Scheduled',
      ]);
    });

    it('filters events by multiple statuses using OR', async () => {
      const completedOrCancelledEvents = await db
        .select()
        .from(schema.events)
        .where(and(
          eq(schema.events.userId, TEST_USER_ID),
          or(
            eq(schema.events.status, 'completed'),
            eq(schema.events.status, 'cancelled')
          )
        ));

      expect(completedOrCancelledEvents).toHaveLength(2);
      expect(completedOrCancelledEvents.map((e) => e.title).sort()).toEqual([
        'Low Cancelled',
        'Medium Completed',
      ]);
    });

    it('returns empty array when filtering with no matches', async () => {
      const noMatches = await db
        .select()
        .from(schema.events)
        .where(and(
          eq(schema.events.userId, TEST_USER_ID),
          eq(schema.events.priority, 'critical'),
          eq(schema.events.status, 'completed')
        ));

      expect(noMatches).toHaveLength(0);
    });
  });
});
