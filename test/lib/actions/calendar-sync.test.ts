import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import { mockAuth } from '@/test/auth-utils';
import * as schema from '@/lib/schema';
import { testCalendarSources, TEST_USER_ID } from '@/test/fixtures';
import { eq } from 'drizzle-orm';

type CalendarSyncActions = typeof import('@/lib/actions/calendar-sync');

describe('Calendar Sync Actions', () => {
  let db: ReturnType<typeof getTestDb>;
  let sourceId: number;

  // Dynamic imports after mocking
  let syncCalendarSource: CalendarSyncActions['syncCalendarSource'];
  let syncAllCalendars: CalendarSyncActions['syncAllCalendars'];

  const tMock = vi.fn(async (key: string) => key);

  // Mock iCal fetch to return test data
  const mockFetchResult = {
    success: true,
    data: `BEGIN:VCALENDAR
VERSION:2.0
X-WR-CALNAME:Test Calendar
BEGIN:VEVENT
DTSTART:20260215T100000Z
DTEND:20260215T110000Z
DTSTAMP:20260101T000000Z
UID:test-event-1
SUMMARY:Test Event 1
LAST-MODIFIED:20260201T000000Z
END:VEVENT
BEGIN:VEVENT
DTSTART:20260220T140000Z
DTEND:20260220T150000Z
DTSTAMP:20260101T000000Z
UID:test-event-2
SUMMARY:Test Event 2
END:VEVENT
END:VCALENDAR`,
  };

  beforeAll(async () => {
    db = await setupTestDb();

    // Mock database
    vi.doMock('@/lib/db', () => ({ db }));

    // Mock auth
    mockAuth();

    // Mock translations
    vi.doMock('@/lib/i18n/server-errors', () => ({ t: tMock }));

    // Mock iCal fetch
    vi.doMock('@/lib/ical/fetch', () => ({
      fetchICalUrlWithRetry: vi.fn(async () => mockFetchResult),
    }));

    // Import actions after mocking
    const actions = await import('@/lib/actions/calendar-sync');
    syncCalendarSource = actions.syncCalendarSource;
    syncAllCalendars = actions.syncAllCalendars;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();

    // Insert test calendar source
    const [source] = await db
      .insert(schema.calendarSources)
      .values(testCalendarSources.google)
      .returning();

    sourceId = source.id;
  });

  it('creates events from iCal feed', async () => {
    const result = await syncCalendarSource(sourceId);

    expect(result.success).toBe(true);
    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.cancelled).toBe(0);

    // Verify events were created
    const events = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.calendarSourceId, sourceId));

    expect(events).toHaveLength(2);
    expect(events[0].title).toBe('Test Event 1');
    expect(events[0].externalId).toBe('test-event-1');
    expect(events[1].title).toBe('Test Event 2');
  });

  it('updates existing events when feed changes', async () => {
    // First sync
    await syncCalendarSource(sourceId);

    // Mock updated feed
    const updatedMockResult = {
      success: true,
      data: `BEGIN:VCALENDAR
VERSION:2.0
X-WR-CALNAME:Test Calendar
BEGIN:VEVENT
DTSTART:20260215T110000Z
DTEND:20260215T120000Z
DTSTAMP:20260101T000000Z
UID:test-event-1
SUMMARY:Updated Event 1
LAST-MODIFIED:20260205T000000Z
END:VEVENT
END:VCALENDAR`,
    };

    const { fetchICalUrlWithRetry } = await import('@/lib/ical/fetch');
    vi.mocked(fetchICalUrlWithRetry).mockResolvedValueOnce(updatedMockResult);

    // Second sync
    const result = await syncCalendarSource(sourceId);

    expect(result.success).toBe(true);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.cancelled).toBe(1); // test-event-2 no longer in feed

    // Verify event was updated
    const events = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.externalId, 'test-event-1'));

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Updated Event 1');

    // Verify orphaned event was cancelled
    const cancelledEvents = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.externalId, 'test-event-2'));

    expect(cancelledEvents).toHaveLength(1);
    expect(cancelledEvents[0].status).toBe('cancelled');
  });

  it('updates source status on success', async () => {
    await syncCalendarSource(sourceId);

    const [source] = await db
      .select()
      .from(schema.calendarSources)
      .where(eq(schema.calendarSources.id, sourceId));

    expect(source.status).toBe('active');
    expect(source.lastSyncedAt).toBeTruthy();
    expect(source.lastError).toBeNull();
  });

  it('updates source status on fetch error', async () => {
    const { fetchICalUrlWithRetry } = await import('@/lib/ical/fetch');
    vi.mocked(fetchICalUrlWithRetry).mockResolvedValueOnce({
      success: false,
      error: 'Network error',
    });

    const result = await syncCalendarSource(sourceId);

    expect(result.success).toBe(false);

    const [source] = await db
      .select()
      .from(schema.calendarSources)
      .where(eq(schema.calendarSources.id, sourceId));

    expect(source.status).toBe('error');
    expect(source.lastError).toBe('Network error');
  });

  it('returns error for non-existent source', async () => {
    const result = await syncCalendarSource(99999);

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toBe('Calendar source not found');
  });

  it('syncAllCalendars syncs multiple sources', async () => {
    // Insert second source
    await db.insert(schema.calendarSources).values(testCalendarSources.outlook);

    const results = await syncAllCalendars();

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);

    // Verify events from both sources
    const allEvents = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.userId, TEST_USER_ID));

    expect(allEvents.length).toBeGreaterThan(0);
  });
});
