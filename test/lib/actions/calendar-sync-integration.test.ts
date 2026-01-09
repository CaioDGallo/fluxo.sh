import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import { mockAuth } from '@/test/auth-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID } from '@/test/fixtures';
import { eq } from 'drizzle-orm';

type CalendarSourceActions = typeof import('@/lib/actions/calendar-sources');
type CalendarSyncActions = typeof import('@/lib/actions/calendar-sync');

describe('Calendar Sync - Integration', () => {
  let db: ReturnType<typeof getTestDb>;

  // Dynamic imports
  let createCalendarSource: CalendarSourceActions['createCalendarSource'];
  let deleteCalendarSource: CalendarSourceActions['deleteCalendarSource'];
  let syncCalendarSource: CalendarSyncActions['syncCalendarSource'];

  const tMock = vi.fn(async (key: string) => key);

  const mockFetchResult = {
    success: true,
    data: `BEGIN:VCALENDAR
VERSION:2.0
X-WR-CALNAME:Integration Test Calendar
BEGIN:VEVENT
DTSTART:20260301T100000Z
DTEND:20260301T110000Z
DTSTAMP:20260101T000000Z
UID:integration-event-1
SUMMARY:Integration Test Event
END:VEVENT
END:VCALENDAR`,
  };

  beforeAll(async () => {
    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({ db }));
    mockAuth();
    vi.doMock('@/lib/i18n/server-errors', () => ({ t: tMock }));
    vi.doMock('@/lib/ical/fetch', () => ({
      fetchICalUrlWithRetry: vi.fn(async () => mockFetchResult),
    }));

    const sourceActions = await import('@/lib/actions/calendar-sources');
    createCalendarSource = sourceActions.createCalendarSource;
    deleteCalendarSource = sourceActions.deleteCalendarSource;

    const syncActions = await import('@/lib/actions/calendar-sync');
    syncCalendarSource = syncActions.syncCalendarSource;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
  });

  it('full lifecycle: create source → sync → events created → delete → cascade', async () => {
    // Step 1: Create calendar source
    const createResult = await createCalendarSource({
      name: 'Integration Test Cal',
      url: 'https://example.com/test.ics',
      color: '#3b82f6',
      status: 'active',
    });

    expect(createResult.success).toBe(true);
    expect(createResult.data?.id).toBeDefined();

    const sourceId = createResult.data!.id;

    // Step 2: Verify source exists
    const sources = await db
      .select()
      .from(schema.calendarSources)
      .where(eq(schema.calendarSources.id, sourceId));

    expect(sources).toHaveLength(1);
    expect(sources[0].name).toBe('Integration Test Cal');

    // Step 3: Sync calendar
    const syncResult = await syncCalendarSource(sourceId);

    expect(syncResult.success).toBe(true);
    expect(syncResult.created).toBe(1);

    // Step 4: Verify events were created with calendarSourceId
    const events = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.calendarSourceId, sourceId));

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Integration Test Event');
    expect(events[0].calendarSourceId).toBe(sourceId);
    expect(events[0].externalId).toBe('integration-event-1');
    expect(events[0].userId).toBe(TEST_USER_ID);

    // Step 5: Delete calendar source
    const deleteResult = await deleteCalendarSource(sourceId);

    expect(deleteResult.success).toBe(true);

    // Step 6: Verify source is deleted
    const deletedSources = await db
      .select()
      .from(schema.calendarSources)
      .where(eq(schema.calendarSources.id, sourceId));

    expect(deletedSources).toHaveLength(0);

    // Step 7: Verify events are cascade deleted (FK constraint)
    const deletedEvents = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.calendarSourceId, sourceId));

    expect(deletedEvents).toHaveLength(0);
  });

  it('handles multiple syncs without duplicating events', async () => {
    // Create source
    const createResult = await createCalendarSource({
      name: 'Multi-Sync Test',
      url: 'https://example.com/test.ics',
      color: '#10b981',
      status: 'active',
    });

    const sourceId = createResult.data!.id;

    // First sync
    const sync1 = await syncCalendarSource(sourceId);
    expect(sync1.success).toBe(true);
    expect(sync1.created).toBe(1);

    // Second sync with same data
    const sync2 = await syncCalendarSource(sourceId);
    expect(sync2.success).toBe(true);
    expect(sync2.created).toBe(0); // No new events
    expect(sync2.updated).toBe(0); // No changes

    // Verify only one event exists
    const events = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.calendarSourceId, sourceId));

    expect(events).toHaveLength(1);
  });
});
