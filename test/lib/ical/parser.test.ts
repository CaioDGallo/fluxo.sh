import { describe, it, expect } from 'vitest';
import { parseICalendar, expandRecurringEvent } from '@/lib/ical/parser';

// Sample iCal data for testing
const GOOGLE_CALENDAR_SAMPLE = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
X-WR-CALNAME:Test Calendar
X-WR-CALDESC:Test calendar description
X-WR-TIMEZONE:America/Sao_Paulo
BEGIN:VEVENT
DTSTART:20260201T100000Z
DTEND:20260201T110000Z
DTSTAMP:20260101T000000Z
UID:event1@google.com
SUMMARY:Team Meeting
DESCRIPTION:Weekly team sync
LOCATION:Conference Room A
SEQUENCE:0
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

const OUTLOOK_ALLDAY_SAMPLE = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Microsoft Corporation//Outlook 16.0 MIMEDIR//EN
X-WR-CALNAME:Work Calendar
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260215
DTEND;VALUE=DATE:20260216
DTSTAMP:20260101T000000Z
UID:event2@outlook.com
SUMMARY:Company Holiday
DESCRIPTION:Office closed
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

const APPLE_RECURRING_SAMPLE = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Apple Inc.//macOS 14.0//EN
X-WR-CALNAME:Personal
BEGIN:VEVENT
DTSTART:20260203T140000Z
DTEND:20260203T150000Z
DTSTAMP:20260101T000000Z
UID:event3@icloud.com
SUMMARY:Daily Standup
RRULE:FREQ=DAILY;COUNT=5
SEQUENCE:0
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

const INVALID_ICAL = `This is not valid iCal data`;

const MINIMAL_EVENT = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260220T100000Z
DTEND:20260220T110000Z
DTSTAMP:20260101T000000Z
UID:minimal@test.com
SUMMARY:Minimal Event
END:VEVENT
END:VCALENDAR`;

const EVENT_NO_UID = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20260220T100000Z
DTEND:20260220T110000Z
DTSTAMP:20260101T000000Z
SUMMARY:No UID Event
END:VEVENT
END:VCALENDAR`;

describe('parseICalendar', () => {
  it('parses Google Calendar format', () => {
    const result = parseICalendar(GOOGLE_CALENDAR_SAMPLE);

    expect(result.name).toBe('Test Calendar');
    expect(result.description).toBe('Test calendar description');
    expect(result.timezone).toBe('America/Sao_Paulo');
    expect(result.events).toHaveLength(1);

    const event = result.events[0];
    expect(event.uid).toBe('event1@google.com');
    expect(event.summary).toBe('Team Meeting');
    expect(event.description).toBe('Weekly team sync');
    expect(event.location).toBe('Conference Room A');
    expect(event.isAllDay).toBe(false);
    expect(event.status).toBe('CONFIRMED');
  });

  it('parses Outlook all-day event', () => {
    const result = parseICalendar(OUTLOOK_ALLDAY_SAMPLE);

    expect(result.name).toBe('Work Calendar');
    expect(result.events).toHaveLength(1);

    const event = result.events[0];
    expect(event.uid).toBe('event2@outlook.com');
    expect(event.summary).toBe('Company Holiday');
    expect(event.isAllDay).toBe(true);
    expect(event.dtstart).toBeInstanceOf(Date);
    expect(event.dtend).toBeInstanceOf(Date);
  });

  it('parses Apple Calendar with RRULE', () => {
    const result = parseICalendar(APPLE_RECURRING_SAMPLE);

    expect(result.name).toBe('Personal');
    expect(result.events).toHaveLength(1);

    const event = result.events[0];
    expect(event.uid).toBe('event3@icloud.com');
    expect(event.summary).toBe('Daily Standup');
    expect(event.rrule).toBe('FREQ=DAILY;COUNT=5');
  });

  it('handles minimal event with only required fields', () => {
    const result = parseICalendar(MINIMAL_EVENT);

    expect(result.events).toHaveLength(1);
    const event = result.events[0];
    expect(event.uid).toBe('minimal@test.com');
    expect(event.summary).toBe('Minimal Event');
    expect(event.description).toBeUndefined();
    expect(event.location).toBeUndefined();
    expect(event.rrule).toBeUndefined();
  });

  it('skips events without UID', () => {
    const result = parseICalendar(EVENT_NO_UID);

    expect(result.events).toHaveLength(0);
  });

  it('throws error on invalid iCal data', () => {
    expect(() => parseICalendar(INVALID_ICAL)).toThrow();
  });
});

describe('expandRecurringEvent', () => {
  it('returns non-recurring event within window', () => {
    const event = {
      uid: 'test1',
      summary: 'Single Event',
      dtstart: new Date('2026-02-15T10:00:00Z'),
      dtend: new Date('2026-02-15T11:00:00Z'),
      isAllDay: false,
    };

    const windowStart = new Date('2026-02-01');
    const windowEnd = new Date('2026-02-28');

    const result = expandRecurringEvent(event, windowStart, windowEnd);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject(event);
  });

  it('returns empty array for event outside window', () => {
    const event = {
      uid: 'test2',
      summary: 'Past Event',
      dtstart: new Date('2025-01-15T10:00:00Z'),
      dtend: new Date('2025-01-15T11:00:00Z'),
      isAllDay: false,
    };

    const windowStart = new Date('2026-02-01');
    const windowEnd = new Date('2026-02-28');

    const result = expandRecurringEvent(event, windowStart, windowEnd);

    expect(result).toHaveLength(0);
  });

  it('expands daily recurring event', () => {
    const event = {
      uid: 'test3',
      summary: 'Daily Event',
      dtstart: new Date('2026-02-01T10:00:00Z'),
      dtend: new Date('2026-02-01T11:00:00Z'),
      isAllDay: false,
      rrule: 'FREQ=DAILY;COUNT=5',
    };

    const windowStart = new Date('2026-02-01');
    const windowEnd = new Date('2026-02-28');

    const result = expandRecurringEvent(event, windowStart, windowEnd);

    expect(result).toHaveLength(5);
    expect(result[0].uid).toBe('test3_2026-02-01T10:00:00.000Z');
    expect(result[1].uid).toBe('test3_2026-02-02T10:00:00.000Z');
    expect(result[0].rrule).toBeUndefined(); // Expanded instances don't have rrule
  });

  it('respects maxOccurrences limit', () => {
    const event = {
      uid: 'test4',
      summary: 'Many Occurrences',
      dtstart: new Date('2026-02-01T10:00:00Z'),
      dtend: new Date('2026-02-01T11:00:00Z'),
      isAllDay: false,
      rrule: 'FREQ=DAILY;COUNT=200', // Request 200, but should limit
    };

    const windowStart = new Date('2026-02-01');
    const windowEnd = new Date('2026-12-31');

    const result = expandRecurringEvent(event, windowStart, windowEnd, 50);

    expect(result).toHaveLength(50);
  });

  it('handles expansion errors gracefully', () => {
    const event = {
      uid: 'test5',
      summary: 'Bad RRULE',
      dtstart: new Date('2026-02-01T10:00:00Z'),
      dtend: new Date('2026-02-01T11:00:00Z'),
      isAllDay: false,
      rrule: 'INVALID_RRULE_FORMAT',
    };

    const windowStart = new Date('2026-02-01');
    const windowEnd = new Date('2026-02-28');

    const result = expandRecurringEvent(event, windowStart, windowEnd);

    expect(result).toHaveLength(0); // Should return empty array on error
  });
});
