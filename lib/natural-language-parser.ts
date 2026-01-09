/**
 * Natural language parser for task/event creation
 * Inspired by Todoist's smart date recognition
 *
 * Example inputs:
 * - "Dentist tomorrow at 9 for 30m p1"
 * - "Meeting friday 3pm for 2h"
 * - "Call mom next week"
 */

import * as chrono from 'chrono-node';

export interface ParsedTask {
  /** Cleaned title (patterns removed) */
  title: string;
  /** Extracted due date/time */
  dueAt?: Date;
  /** Extracted start time (when duration present) */
  startAt?: Date;
  /** Extracted duration in minutes */
  durationMinutes?: number;
  /** Extracted priority */
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

interface ExtractedPattern {
  pattern: string;
  start: number;
  end: number;
}

/**
 * Duration patterns:
 * - "for 30m" / "for 30 min" / "for 30 minutes"
 * - "for 2h" / "for 2 hr" / "for 2 hours"
 */
const DURATION_REGEX = /\bfor\s+(\d+)\s*(m|min|minutes?|h|hr|hours?)\b/i;

/**
 * Priority patterns:
 * - p1 → critical
 * - p2 → high
 * - p3 → medium
 * - p4 → low
 */
const PRIORITY_REGEX = /\bp([1-4])\b/i;

const PRIORITY_MAP: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
  '1': 'critical',
  '2': 'high',
  '3': 'medium',
  '4': 'low',
};

/**
 * Parse natural language input into structured task data
 *
 * @param text - The input string (e.g., "Dentist tomorrow at 9 for 30m p1")
 * @param referenceDate - Reference date for relative dates (defaults to now)
 * @returns Parsed task data with cleaned title
 */
export function parseTaskInput(
  text: string,
  referenceDate: Date = new Date()
): ParsedTask {
  const extractedPatterns: ExtractedPattern[] = [];

  // Extract duration FIRST so we can filter it out from chrono results
  let durationMinutes: number | undefined;
  const durationMatch = text.match(DURATION_REGEX);
  if (durationMatch) {
    const value = parseInt(durationMatch[1]);
    const unit = durationMatch[2].toLowerCase();

    if (unit.startsWith('h')) {
      durationMinutes = value * 60;
    } else {
      durationMinutes = value;
    }

    extractedPatterns.push({
      pattern: durationMatch[0],
      start: durationMatch.index!,
      end: durationMatch.index! + durationMatch[0].length,
    });
  }

  // Extract date/time using chrono-node, filtering out duration patterns
  const chronoResults = chrono.parse(text, referenceDate, { forwardDate: true });
  let dueAt: Date | undefined;
  let startAt: Date | undefined;

  // Find first chrono result that's NOT a duration pattern
  const dateResult = chronoResults.find(result => {
    // Skip if this matches our duration pattern
    if (durationMatch && result.index === durationMatch.index) {
      return false;
    }
    return true;
  });

  if (dateResult) {
    // Store the date text for removal
    extractedPatterns.push({
      pattern: dateResult.text,
      start: dateResult.index,
      end: dateResult.index + dateResult.text.length,
    });

    dueAt = dateResult.start.date();

    // If duration is present and we have a time, adjust startAt and dueAt
    if (durationMinutes && dateResult.start.isCertain('hour')) {
      startAt = dueAt;
      dueAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
    }
  }

  // Extract priority
  let priority: ParsedTask['priority'] | undefined;
  const priorityMatch = text.match(PRIORITY_REGEX);
  if (priorityMatch) {
    priority = PRIORITY_MAP[priorityMatch[1]];

    extractedPatterns.push({
      pattern: priorityMatch[0],
      start: priorityMatch.index!,
      end: priorityMatch.index! + priorityMatch[0].length,
    });
  }

  // Remove extracted patterns from title (in reverse order to preserve indices)
  let cleanedTitle = text;
  const sortedPatterns = extractedPatterns.sort((a, b) => b.start - a.start);
  for (const pattern of sortedPatterns) {
    cleanedTitle =
      cleanedTitle.slice(0, pattern.start) +
      cleanedTitle.slice(pattern.end);
  }

  // Clean up extra whitespace
  cleanedTitle = cleanedTitle.replace(/\s+/g, ' ').trim();

  return {
    title: cleanedTitle,
    dueAt,
    startAt,
    durationMinutes,
    priority,
  };
}
