import ICAL from 'ical.js';
import { rrulestr } from 'rrule';
import type { ParsedCalendar, ParsedEvent } from './types';
import { logError, logForDebugging } from '@/lib/logger';
import { ErrorIds } from '@/constants/errorIds';

/**
 * Parse iCal string into structured calendar data
 */
export function parseICalendar(icalString: string): ParsedCalendar {
  try {
    const jcalData = ICAL.parse(icalString);
    const vcalendar = new ICAL.Component(jcalData);

    // Register timezones from VTIMEZONE components
    registerTimezones(vcalendar);

    // Extract calendar metadata
    const name = vcalendar.getFirstPropertyValue('x-wr-calname') as string | undefined;
    const description = vcalendar.getFirstPropertyValue('x-wr-caldesc') as string | undefined;
    const timezone = vcalendar.getFirstPropertyValue('x-wr-timezone') as string | undefined;

    // Parse all VEVENT components
    const vevents = vcalendar.getAllSubcomponents('vevent');
    const events: ParsedEvent[] = [];

    for (const vevent of vevents) {
      try {
        const parsed = parseVEvent(vevent);
        if (parsed) {
          events.push(parsed);
        }
      } catch (eventError) {
        const uid = vevent.getFirstPropertyValue('uid');
        logForDebugging('ical:parse', `Failed to parse event ${uid}`, eventError);
      }
    }

    return { name, description, timezone, events };
  } catch (error) {
    logError(ErrorIds.CALENDAR_SYNC_PARSE_FAILED, 'Failed to parse iCal', error);
    throw new Error(`iCal parse error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * Register VTIMEZONE components with ical.js
 */
function registerTimezones(vcalendar: ICAL.Component): void {
  const vtimezones = vcalendar.getAllSubcomponents('vtimezone');

  for (const vtz of vtimezones) {
    try {
      const tzid = vtz.getFirstPropertyValue('tzid') as string;
      if (tzid && !ICAL.TimezoneService.has(tzid)) {
        const tz = new ICAL.Timezone(vtz);
        ICAL.TimezoneService.register(tzid, tz);
      }
    } catch {
      // Ignore timezone registration errors
    }
  }
}

/**
 * Parse single VEVENT component
 */
function parseVEvent(vevent: ICAL.Component): ParsedEvent | null {
  const event = new ICAL.Event(vevent, { strictExceptions: false });

  const uid = event.uid;
  if (!uid) {
    return null; // UID is required
  }

  const summary = event.summary || 'Untitled Event';
  const description = event.description || undefined;
  const location = event.location || undefined;

  // Handle dates
  const dtstart = event.startDate;
  const dtend = event.endDate;

  if (!dtstart) {
    return null; // Start date is required
  }

  const isAllDay = dtstart.isDate;
  const startAt = dtstart.toJSDate();

  // Calculate end time
  let endAt: Date;
  if (dtend) {
    endAt = dtend.toJSDate();
  } else if (event.duration) {
    endAt = new Date(startAt.getTime() + event.duration.toSeconds() * 1000);
  } else if (isAllDay) {
    // All-day events without end default to 1 day
    endAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);
  } else {
    // Timed events without end default to 1 hour
    endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
  }

  // Extract RRULE if present
  const rruleProp = vevent.getFirstPropertyValue('rrule');
  const rrule = rruleProp ? rruleProp.toString() : undefined;

  // Last modified timestamp
  const lastModifiedProp = vevent.getFirstPropertyValue('last-modified');
  const lastModified = lastModifiedProp
    ? (lastModifiedProp as ICAL.Time).toJSDate()
    : undefined;

  // Status mapping
  const statusProp = vevent.getFirstPropertyValue('status') as string | undefined;
  const status = mapEventStatus(statusProp);

  return {
    uid,
    summary,
    description,
    location,
    dtstart: startAt,
    dtend: endAt,
    isAllDay,
    rrule,
    lastModified,
    sequence: event.sequence,
    status,
  };
}

function mapEventStatus(status?: string): 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED' | undefined {
  switch (status?.toUpperCase()) {
    case 'CONFIRMED': return 'CONFIRMED';
    case 'TENTATIVE': return 'TENTATIVE';
    case 'CANCELLED': return 'CANCELLED';
    default: return undefined;
  }
}

/**
 * Parse iCal recurrence rule and expand occurrences
 */
export function expandRecurringEvent(
  event: ParsedEvent,
  windowStart: Date,
  windowEnd: Date,
  maxOccurrences: number = 100
): ParsedEvent[] {
  if (!event.rrule) {
    // Not recurring, return as-is if within window
    if (event.dtend >= windowStart && event.dtstart <= windowEnd) {
      return [event];
    }
    return [];
  }

  try {
    // Use existing rrule package for expansion (already in project)
    const rule = rrulestr(`RRULE:${event.rrule}`, { dtstart: event.dtstart });
    const occurrences = rule.between(windowStart, windowEnd, true);

    // Limit occurrences
    const limited = occurrences.slice(0, maxOccurrences);
    const duration = event.dtend.getTime() - event.dtstart.getTime();

    return limited.map((date: Date) => ({
      ...event,
      uid: `${event.uid}_${date.toISOString()}`, // Unique ID for occurrence
      dtstart: date,
      dtend: new Date(date.getTime() + duration),
      rrule: undefined, // Clear rrule for expanded instances
    }));
  } catch (error) {
    logForDebugging('ical:expand', `Failed to expand recurring event ${event.uid}`, error);
    return [];
  }
}
