import type { Event } from '@/lib/schema';

/**
 * Parsed event from iCal VEVENT component
 */
export interface ParsedEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  dtstart: Date;
  dtend: Date;
  isAllDay: boolean;
  rrule?: string;
  lastModified?: Date;
  sequence?: number;
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
}

/**
 * Parsed calendar from iCal VCALENDAR
 */
export interface ParsedCalendar {
  name?: string;
  description?: string;
  timezone?: string;
  events: ParsedEvent[];
}

/**
 * Result of syncing a calendar source
 */
export interface SyncResult {
  success: boolean;
  calendarSourceId: number;
  created: number;
  updated: number;
  cancelled: number;
  errors: SyncError[];
  syncedAt: Date;
}

/**
 * Individual sync error
 */
export interface SyncError {
  eventUid?: string;
  message: string;
  type: 'fetch' | 'parse' | 'upsert' | 'unknown';
}

/**
 * Fetch result from iCal URL
 */
export interface FetchResult {
  success: boolean;
  data?: string;
  error?: string;
  headers?: Record<string, string>;
}

/**
 * Diff result for sync operation
 */
export interface EventDiff {
  toCreate: ParsedEvent[];
  toUpdate: Array<{ existing: Event; parsed: ParsedEvent }>;
  toCancel: Event[];
}
