import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID, createTestEvent } from '@/test/fixtures';

type EventsActions = typeof import('@/lib/actions/events');

const OTHER_USER_ID = 'other-user-id';

describe('Event Actions - Update Event', () => {
  let db: ReturnType<typeof getTestDb>;

  let updateEvent: EventsActions['updateEvent'];

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
    updateEvent = eventActions.updateEvent;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  it('updates event fields and preserves ownership', async () => {
    const [event] = await db
      .insert(schema.events)
      .values(createTestEvent({ title: 'Original', location: 'Room A' }))
      .returning();

    const newStartAt = new Date('2026-02-02T09:00:00Z');
    const newEndAt = new Date('2026-02-02T10:00:00Z');

    const result = await updateEvent(event.id, {
      title: 'Updated',
      location: 'Room B',
      startAt: newStartAt,
      endAt: newEndAt,
    });

    expect(result).toEqual({ success: true });

    const [updated] = await db.select().from(schema.events);
    expect(updated.title).toBe('Updated');
    expect(updated.location).toBe('Room B');
    expect(updated.startAt).toEqual(newStartAt);
    expect(updated.endAt).toEqual(newEndAt);
    expect(updated.userId).toBe(TEST_USER_ID);
  });

  it('supports partial updates without overwriting other fields', async () => {
    const [event] = await db
      .insert(schema.events)
      .values(createTestEvent({ title: 'Original', description: 'Keep me' }))
      .returning();

    const result = await updateEvent(event.id, { title: 'Only Title Updated' });
    expect(result).toEqual({ success: true });

    const [updated] = await db.select().from(schema.events);
    expect(updated.title).toBe('Only Title Updated');
    expect(updated.description).toBe('Keep me');
    expect(updated.startAt).toEqual(event.startAt);
    expect(updated.endAt).toEqual(event.endAt);
  });

  it('returns notFound when event belongs to another user', async () => {
    const [event] = await db
      .insert(schema.events)
      .values(createTestEvent({ userId: OTHER_USER_ID, title: 'Other Event' }))
      .returning();

    const result = await updateEvent(event.id, { title: 'Should Not Update' });

    expect(result.success).toBe(false);

    const [unchanged] = await db.select().from(schema.events);
    expect(unchanged.title).toBe('Other Event');
  });

  it('reschedules notification jobs when startAt changes', async () => {
    const [event] = await db
      .insert(schema.events)
      .values(createTestEvent({ title: 'Event With Notifications' }))
      .returning();

    const [notification1] = await db
      .insert(schema.notifications)
      .values({
        itemType: 'event',
        itemId: event.id,
        offsetMinutes: 15,
        channel: 'email',
        enabled: true,
      })
      .returning();

    const [notification2] = await db
      .insert(schema.notifications)
      .values({
        itemType: 'event',
        itemId: event.id,
        offsetMinutes: 60,
        channel: 'email',
        enabled: true,
      })
      .returning();

    const newStartAt = new Date('2026-03-01T10:00:00Z');
    const newEndAt = new Date('2026-03-01T11:00:00Z');
    const result = await updateEvent(event.id, { startAt: newStartAt, endAt: newEndAt });

    expect(result).toEqual({ success: true });

    const jobs = await db.select().from(schema.notificationJobs);
    expect(jobs).toHaveLength(2);

    const job1 = jobs.find((job) => job.notificationId === notification1.id);
    expect(job1).toBeDefined();
    expect(job1?.scheduledAt).toEqual(new Date(newStartAt.getTime() - 15 * 60000));

    const job2 = jobs.find((job) => job.notificationId === notification2.id);
    expect(job2).toBeDefined();
    expect(job2?.scheduledAt).toEqual(new Date(newStartAt.getTime() - 60 * 60000));
  });

  it('does not reschedule notification jobs when startAt is not provided', async () => {
    const [event] = await db
      .insert(schema.events)
      .values(createTestEvent({ title: 'No Reschedule' }))
      .returning();

    await db.insert(schema.notifications).values({
      itemType: 'event',
      itemId: event.id,
      offsetMinutes: 30,
      channel: 'email',
      enabled: true,
    });

    const result = await updateEvent(event.id, { title: 'Updated Title' });
    expect(result).toEqual({ success: true });

    const jobs = await db.select().from(schema.notificationJobs);
    expect(jobs).toHaveLength(0);
  });

  it('updates updatedAt timestamp', async () => {
    const oldUpdatedAt = new Date('2026-01-01T00:00:00Z');
    const [event] = await db
      .insert(schema.events)
      .values(createTestEvent({ title: 'Timestamp Test', updatedAt: oldUpdatedAt }))
      .returning();

    const result = await updateEvent(event.id, { title: 'Timestamp Updated' });
    expect(result).toEqual({ success: true });

    const [updated] = await db.select().from(schema.events);
    expect(updated.updatedAt).toBeDefined();
    expect(updated.updatedAt?.getTime()).toBeGreaterThan(oldUpdatedAt.getTime());
  });
});
