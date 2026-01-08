import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID } from '@/test/fixtures';
import { revalidatePath, revalidateTag } from 'next/cache';
import { eq, and } from 'drizzle-orm';

type EventsActions = typeof import('@/lib/actions/events');

describe('Event Actions - Delete Event', () => {
  let db: ReturnType<typeof getTestDb>;

  let deleteEvent: EventsActions['deleteEvent'];

  let getCurrentUserIdMock: ReturnType<typeof vi.fn>;

  const revalidatePathMock = vi.mocked(revalidatePath);
  const revalidateTagMock = vi.mocked(revalidateTag);

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
    deleteEvent = eventActions.deleteEvent;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  describe('deleteEvent', () => {
    it('deletes event successfully', async () => {
      // Create test event
      const [event] = await db
        .insert(schema.events)
        .values({
          userId: TEST_USER_ID,
          title: 'Event to Delete',
          startAt: new Date('2026-02-01T10:00:00Z'),
          endAt: new Date('2026-02-01T11:00:00Z'),
        })
        .returning();

      const result = await deleteEvent(event.id);

      expect(result.success).toBe(true);

      // Verify event was deleted
      const events = await db.select().from(schema.events).where(eq(schema.events.id, event.id));
      expect(events).toHaveLength(0);
    });

    it('cascades delete to notificationJobs', async () => {
      // Create test event
      const [event] = await db
        .insert(schema.events)
        .values({
          userId: TEST_USER_ID,
          title: 'Event with Notification Jobs',
          startAt: new Date('2026-02-01T10:00:00Z'),
          endAt: new Date('2026-02-01T11:00:00Z'),
        })
        .returning();

      // Create notification config
      const [notification] = await db
        .insert(schema.notifications)
        .values({
          itemType: 'event',
          itemId: event.id,
          offsetMinutes: 15,
          channel: 'email',
          enabled: true,
        })
        .returning();

      // Create notification jobs
      await db.insert(schema.notificationJobs).values([
        {
          itemType: 'event',
          itemId: event.id,
          notificationId: notification.id,
          channel: 'email',
          scheduledAt: new Date('2026-02-01T09:45:00Z'),
          status: 'pending',
        },
        {
          itemType: 'event',
          itemId: event.id,
          notificationId: notification.id,
          channel: 'email',
          scheduledAt: new Date('2026-02-01T09:00:00Z'),
          status: 'pending',
        },
      ]);

      // Create another event with jobs to verify they remain
      const [otherEvent] = await db
        .insert(schema.events)
        .values({
          userId: TEST_USER_ID,
          title: 'Other Event',
          startAt: new Date('2026-02-02T10:00:00Z'),
          endAt: new Date('2026-02-02T11:00:00Z'),
        })
        .returning();

      const [otherNotification] = await db
        .insert(schema.notifications)
        .values({
          itemType: 'event',
          itemId: otherEvent.id,
          offsetMinutes: 15,
          channel: 'email',
          enabled: true,
        })
        .returning();

      await db.insert(schema.notificationJobs).values({
        itemType: 'event',
        itemId: otherEvent.id,
        notificationId: otherNotification.id,
        channel: 'email',
        scheduledAt: new Date('2026-02-02T09:45:00Z'),
        status: 'pending',
      });

      const result = await deleteEvent(event.id);

      expect(result.success).toBe(true);

      // Verify jobs for deleted event are gone
      const deletedEventJobs = await db
        .select()
        .from(schema.notificationJobs)
        .where(
          and(eq(schema.notificationJobs.itemType, 'event'), eq(schema.notificationJobs.itemId, event.id))
        );
      expect(deletedEventJobs).toHaveLength(0);

      // Verify jobs for other event remain
      const otherEventJobs = await db
        .select()
        .from(schema.notificationJobs)
        .where(
          and(eq(schema.notificationJobs.itemType, 'event'), eq(schema.notificationJobs.itemId, otherEvent.id))
        );
      expect(otherEventJobs).toHaveLength(1);
    });

    it('cascades delete to notifications', async () => {
      // Create test event
      const [event] = await db
        .insert(schema.events)
        .values({
          userId: TEST_USER_ID,
          title: 'Event with Notifications',
          startAt: new Date('2026-02-01T10:00:00Z'),
          endAt: new Date('2026-02-01T11:00:00Z'),
        })
        .returning();

      // Create notifications
      await db.insert(schema.notifications).values([
        {
          itemType: 'event',
          itemId: event.id,
          offsetMinutes: 15,
          channel: 'email',
          enabled: true,
        },
        {
          itemType: 'event',
          itemId: event.id,
          offsetMinutes: 60,
          channel: 'email',
          enabled: true,
        },
      ]);

      // Create another event with notifications to verify they remain
      const [otherEvent] = await db
        .insert(schema.events)
        .values({
          userId: TEST_USER_ID,
          title: 'Other Event',
          startAt: new Date('2026-02-02T10:00:00Z'),
          endAt: new Date('2026-02-02T11:00:00Z'),
        })
        .returning();

      await db.insert(schema.notifications).values({
        itemType: 'event',
        itemId: otherEvent.id,
        offsetMinutes: 15,
        channel: 'email',
        enabled: true,
      });

      const result = await deleteEvent(event.id);

      expect(result.success).toBe(true);

      // Verify notifications for deleted event are gone
      const deletedEventNotifications = await db
        .select()
        .from(schema.notifications)
        .where(
          and(eq(schema.notifications.itemType, 'event'), eq(schema.notifications.itemId, event.id))
        );
      expect(deletedEventNotifications).toHaveLength(0);

      // Verify notifications for other event remain
      const otherEventNotifications = await db
        .select()
        .from(schema.notifications)
        .where(
          and(eq(schema.notifications.itemType, 'event'), eq(schema.notifications.itemId, otherEvent.id))
        );
      expect(otherEventNotifications).toHaveLength(1);
    });

    it('cascades delete to recurrenceRules', async () => {
      // Create test event
      const [event] = await db
        .insert(schema.events)
        .values({
          userId: TEST_USER_ID,
          title: 'Recurring Event',
          startAt: new Date('2026-02-01T10:00:00Z'),
          endAt: new Date('2026-02-01T11:00:00Z'),
        })
        .returning();

      // Create recurrence rule
      await db.insert(schema.recurrenceRules).values({
        itemType: 'event',
        itemId: event.id,
        rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR',
      });

      // Create another event with recurrence to verify it remains
      const [otherEvent] = await db
        .insert(schema.events)
        .values({
          userId: TEST_USER_ID,
          title: 'Other Recurring Event',
          startAt: new Date('2026-02-02T10:00:00Z'),
          endAt: new Date('2026-02-02T11:00:00Z'),
        })
        .returning();

      await db.insert(schema.recurrenceRules).values({
        itemType: 'event',
        itemId: otherEvent.id,
        rrule: 'FREQ=DAILY',
      });

      const result = await deleteEvent(event.id);

      expect(result.success).toBe(true);

      // Verify recurrence rule for deleted event is gone
      const deletedEventRules = await db
        .select()
        .from(schema.recurrenceRules)
        .where(
          and(eq(schema.recurrenceRules.itemType, 'event'), eq(schema.recurrenceRules.itemId, event.id))
        );
      expect(deletedEventRules).toHaveLength(0);

      // Verify recurrence rule for other event remains
      const otherEventRules = await db
        .select()
        .from(schema.recurrenceRules)
        .where(
          and(eq(schema.recurrenceRules.itemType, 'event'), eq(schema.recurrenceRules.itemId, otherEvent.id))
        );
      expect(otherEventRules).toHaveLength(1);
    });

    it('handles missing related records gracefully', async () => {
      // Create event without any related records
      const [event] = await db
        .insert(schema.events)
        .values({
          userId: TEST_USER_ID,
          title: 'Standalone Event',
          startAt: new Date('2026-02-01T10:00:00Z'),
          endAt: new Date('2026-02-01T11:00:00Z'),
        })
        .returning();

      const result = await deleteEvent(event.id);

      expect(result.success).toBe(true);

      // Verify event was deleted
      const events = await db.select().from(schema.events).where(eq(schema.events.id, event.id));
      expect(events).toHaveLength(0);
    });

    it('revalidates calendar path and events tag on delete', async () => {
      const [event] = await db
        .insert(schema.events)
        .values({
          userId: TEST_USER_ID,
          title: 'Event to Delete',
          startAt: new Date('2026-02-01T10:00:00Z'),
          endAt: new Date('2026-02-01T11:00:00Z'),
        })
        .returning();

      await deleteEvent(event.id);

      expect(revalidatePathMock).toHaveBeenCalledWith('/calendar');
      expect(revalidateTagMock).toHaveBeenCalledWith('events', 'default');
    });

    it('respects user ownership when deleting', async () => {
      // Create event owned by different user
      const [event] = await db
        .insert(schema.events)
        .values({
          userId: 'different-user-id',
          title: 'Other Users Event',
          startAt: new Date('2026-02-01T10:00:00Z'),
          endAt: new Date('2026-02-01T11:00:00Z'),
        })
        .returning();

      const result = await deleteEvent(event.id);

      expect(result.success).toBe(true);

      // Verify event was NOT deleted (still exists)
      const events = await db.select().from(schema.events).where(eq(schema.events.id, event.id));
      expect(events).toHaveLength(1);
    });

    it('handles non-existent event gracefully', async () => {
      const result = await deleteEvent(99999);

      expect(result.success).toBe(true);

      // No error should be thrown for missing event
    });
  });
});
