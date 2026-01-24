'use server';

import { db } from '@/lib/db';
import { calendarSources, events, type Event } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { logError, logForDebugging, logEvent } from '@/lib/logger';
import { ErrorIds } from '@/constants/errorIds';
import { fetchICalUrlWithRetry } from '@/lib/ical/fetch';
import { parseICalendar, expandRecurringEvent } from '@/lib/ical/parser';
import type { SyncResult, SyncError, ParsedEvent, EventDiff } from '@/lib/ical/types';
import { requireCronAuth } from '@/lib/cron-auth';
import { checkCalendarSyncRateLimit } from '@/lib/rate-limit';

// Sync window: 6 months forward
const SYNC_WINDOW_MONTHS = 6;
const MAX_OCCURRENCES = 100;

/**
 * Internal sync function that accepts userId parameter (no session required)
 */
async function syncCalendarSourceInternal(
  calendarSourceId: number,
  userId: string
): Promise<SyncResult> {
  const syncedAt = new Date();
  const errors: SyncError[] = [];
  let created = 0;
  let updated = 0;
  let cancelled = 0;

  try {
    // Get calendar source
    const [source] = await db
      .select()
      .from(calendarSources)
      .where(and(
        eq(calendarSources.id, calendarSourceId),
        eq(calendarSources.userId, userId)
      ))
      .limit(1);

    if (!source) {
      return {
        success: false,
        calendarSourceId,
        created: 0,
        updated: 0,
        cancelled: 0,
        errors: [{ message: 'Calendar source not found', type: 'unknown' }],
        syncedAt,
      };
    }

    logForDebugging('calendar-sync', `Starting sync for ${source.name}`, { id: source.id });

    // Fetch iCal data with retry
    const fetchResult = await fetchICalUrlWithRetry(source.url, 3);
    if (!fetchResult.success || !fetchResult.data) {
      await updateSourceStatus(source.id, 'error', fetchResult.error ?? 'Fetch failed');
      return {
        success: false,
        calendarSourceId,
        created: 0,
        updated: 0,
        cancelled: 0,
        errors: [{ message: fetchResult.error ?? 'Fetch failed', type: 'fetch' }],
        syncedAt,
      };
    }

    // Parse iCal content
    let parsedCalendar;
    try {
      parsedCalendar = parseICalendar(fetchResult.data);
    } catch (parseError) {
      const msg = parseError instanceof Error ? parseError.message : 'Parse failed';
      await updateSourceStatus(source.id, 'error', msg);
      return {
        success: false,
        calendarSourceId,
        created: 0,
        updated: 0,
        cancelled: 0,
        errors: [{ message: msg, type: 'parse' }],
        syncedAt,
      };
    }

    // Calculate sync window
    const windowStart = new Date();
    const windowEnd = new Date();
    windowEnd.setMonth(windowEnd.getMonth() + SYNC_WINDOW_MONTHS);

    // Expand recurring events
    const expandedEvents: ParsedEvent[] = [];
    for (const event of parsedCalendar.events) {
      const expanded = expandRecurringEvent(event, windowStart, windowEnd, MAX_OCCURRENCES);
      expandedEvents.push(...expanded);
    }

    // Get existing events for this source
    const existingEvents = await db
      .select()
      .from(events)
      .where(and(
        eq(events.calendarSourceId, source.id),
        eq(events.userId, userId)
      ));

    // Calculate diff
    const diff = calculateDiff(existingEvents, expandedEvents);

    // Apply changes in transaction
    await db.transaction(async (tx) => {
      // Create new events
      for (const parsed of diff.toCreate) {
        try {
          await tx.insert(events).values({
            userId,
            title: parsed.summary,
            description: parsed.description,
            location: parsed.location,
            startAt: parsed.dtstart,
            endAt: parsed.dtend,
            isAllDay: parsed.isAllDay,
            externalId: parsed.uid,
            calendarSourceId: source.id,
            externalUpdatedAt: parsed.lastModified,
            status: parsed.status === 'CANCELLED' ? 'cancelled' : 'scheduled',
          });
          created++;
        } catch {
          errors.push({ eventUid: parsed.uid, message: 'Failed to create', type: 'upsert' });
        }
      }

      // Update existing events
      for (const { existing, parsed } of diff.toUpdate) {
        try {
          await tx.update(events)
            .set({
              title: parsed.summary,
              description: parsed.description,
              location: parsed.location,
              startAt: parsed.dtstart,
              endAt: parsed.dtend,
              isAllDay: parsed.isAllDay,
              externalUpdatedAt: parsed.lastModified,
              status: parsed.status === 'CANCELLED' ? 'cancelled' : 'scheduled',
              updatedAt: new Date(),
            })
            .where(eq(events.id, existing.id));
          updated++;
        } catch {
          errors.push({ eventUid: parsed.uid, message: 'Failed to update', type: 'upsert' });
        }
      }

      // Cancel orphaned events (no longer in feed)
      for (const orphan of diff.toCancel) {
        try {
          await tx.update(events)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(events.id, orphan.id));
          cancelled++;
        } catch {
          errors.push({ eventUid: orphan.externalId ?? undefined, message: 'Failed to cancel', type: 'upsert' });
        }
      }

      // Update source status
      await tx.update(calendarSources)
        .set({
          lastSyncedAt: syncedAt,
          lastError: null,
          status: 'active',
          updatedAt: syncedAt,
        })
        .where(eq(calendarSources.id, source.id));
    });

    logEvent('calendar_synced', {
      calendarSourceId,
      created,
      updated,
      cancelled,
      errorCount: errors.length,
    });

    revalidatePath('/calendar');
    revalidateTag('events', 'default');

    return {
      success: errors.length === 0,
      calendarSourceId,
      created,
      updated,
      cancelled,
      errors,
      syncedAt,
    };
  } catch (error) {
    logError(ErrorIds.CALENDAR_SYNC_UPSERT_FAILED, 'Calendar sync failed', error, { calendarSourceId });
    return {
      success: false,
      calendarSourceId,
      created,
      updated,
      cancelled,
      errors: [...errors, { message: error instanceof Error ? error.message : 'Unknown error', type: 'unknown' }],
      syncedAt,
    };
  }
}

/**
 * Sync a single calendar source (session-based)
 */
export async function syncCalendarSource(calendarSourceId: number): Promise<SyncResult> {
  const userId = await getCurrentUserId();

  // Rate limiting
  const rateLimit = await checkCalendarSyncRateLimit(userId);
  if (!rateLimit.allowed) {
    return {
      success: false,
      calendarSourceId,
      created: 0,
      updated: 0,
      cancelled: 0,
      errors: [{
        message: `Muitas requisições. Tente novamente em ${rateLimit.retryAfter}s`,
        type: 'unknown',
      }],
      syncedAt: new Date(),
    };
  }

  return syncCalendarSourceInternal(calendarSourceId, userId);
}

/**
 * Sync all active calendar sources for current user (session-based)
 */
export async function syncAllCalendars(): Promise<SyncResult[]> {
  try {
    const userId = await getCurrentUserId();

    // Rate limiting
    const rateLimit = await checkCalendarSyncRateLimit(userId);
    if (!rateLimit.allowed) {
      return [{
        success: false,
        calendarSourceId: 0,
        created: 0,
        updated: 0,
        cancelled: 0,
        errors: [{
          message: `Muitas requisições. Tente novamente em ${rateLimit.retryAfter}s`,
          type: 'unknown',
        }],
        syncedAt: new Date(),
      }];
    }

    const sources = await db
      .select()
      .from(calendarSources)
      .where(and(
        eq(calendarSources.userId, userId),
        eq(calendarSources.status, 'active')
      ));

    const results: SyncResult[] = [];

    for (const source of sources) {
      const result = await syncCalendarSourceInternal(source.id, userId);
      results.push(result);
    }

    return results;
  } catch (error) {
    logError(ErrorIds.CALENDAR_SYNC_UPSERT_FAILED, 'Failed to sync all calendars', error);
    return [];
  }
}

/**
 * Sync all active calendar sources for ALL users (cron-compatible, no session required)
 */
export async function syncAllUsersCalendars(): Promise<{
  success: boolean;
  usersProcessed: number;
  sourcesProcessed: number;
  results: SyncResult[];
}> {
  // Defense-in-depth: verify cron authorization
  await requireCronAuth();

  try {
    const sources = await db
      .select()
      .from(calendarSources)
      .where(eq(calendarSources.status, 'active'));

    const results: SyncResult[] = [];
    const userIds = new Set<string>();

    for (const source of sources) {
      userIds.add(source.userId);
      const result = await syncCalendarSourceInternal(source.id, source.userId);
      results.push(result);
    }

    logEvent('calendar_sync_all_users', {
      usersProcessed: userIds.size,
      sourcesProcessed: sources.length,
      successCount: results.filter(r => r.success).length,
    });

    return {
      success: true,
      usersProcessed: userIds.size,
      sourcesProcessed: sources.length,
      results,
    };
  } catch (error) {
    logError(ErrorIds.CALENDAR_SYNC_UPSERT_FAILED, 'Failed to sync all users calendars', error);
    return {
      success: false,
      usersProcessed: 0,
      sourcesProcessed: 0,
      results: [],
    };
  }
}

/**
 * Calculate diff between existing events and parsed events
 */
function calculateDiff(existing: Event[], parsed: ParsedEvent[]): EventDiff {
  const existingByUid = new Map<string, Event>();
  for (const event of existing) {
    if (event.externalId) {
      existingByUid.set(event.externalId, event);
    }
  }

  const parsedUids = new Set(parsed.map(e => e.uid));

  const toCreate: ParsedEvent[] = [];
  const toUpdate: Array<{ existing: Event; parsed: ParsedEvent }> = [];
  const toCancel: Event[] = [];

  // Check each parsed event
  for (const p of parsed) {
    const existingEvent = existingByUid.get(p.uid);

    if (!existingEvent) {
      toCreate.push(p);
    } else if (needsUpdate(existingEvent, p)) {
      toUpdate.push({ existing: existingEvent, parsed: p });
    }
  }

  // Find orphans (existing events not in parsed set)
  for (const [uid, existingEvent] of existingByUid) {
    if (!parsedUids.has(uid) && existingEvent.status !== 'cancelled' && existingEvent.status !== 'completed') {
      toCancel.push(existingEvent);
    }
  }

  return { toCreate, toUpdate, toCancel };
}

/**
 * Check if existing event needs update based on parsed data
 */
function needsUpdate(existing: Event, parsed: ParsedEvent): boolean {
  // If we have lastModified timestamps, compare them
  if (parsed.lastModified && existing.externalUpdatedAt) {
    return parsed.lastModified > existing.externalUpdatedAt;
  }

  // Otherwise, compare key fields
  return (
    existing.title !== parsed.summary ||
    existing.description !== (parsed.description ?? null) ||
    existing.location !== (parsed.location ?? null) ||
    existing.startAt.getTime() !== parsed.dtstart.getTime() ||
    existing.endAt.getTime() !== parsed.dtend.getTime() ||
    existing.isAllDay !== parsed.isAllDay
  );
}

/**
 * Update calendar source status
 */
async function updateSourceStatus(
  id: number,
  status: 'active' | 'error' | 'disabled',
  error?: string
): Promise<void> {
  await db.update(calendarSources)
    .set({
      status,
      lastError: error ?? null,
      updatedAt: new Date(),
    })
    .where(eq(calendarSources.id, id));
}
