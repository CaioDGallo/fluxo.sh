'use server';

import { db } from '@/lib/db';
import { events, tasks } from '@/lib/schema';
import { eq, and, lt, or } from 'drizzle-orm';

export interface StatusUpdateResult {
  eventsCompleted: number;
  tasksMarkedOverdue: number;
}

/**
 * Updates status of past events and tasks:
 * - Events: endAt < now AND status='scheduled' → status='completed'
 * - Tasks: dueAt < now AND status IN ('pending','in_progress') → status='overdue'
 */
export async function updatePastItemStatuses(): Promise<StatusUpdateResult> {
  const now = new Date();
  let eventsCompleted = 0;
  let tasksMarkedOverdue = 0;

  try {
    // Update events that have ended but are still scheduled
    const completedEvents = await db
      .update(events)
      .set({
        status: 'completed',
        updatedAt: now,
      })
      .where(
        and(
          eq(events.status, 'scheduled'),
          lt(events.endAt, now)
        )
      )
      .returning({ id: events.id });

    eventsCompleted = completedEvents.length;

    console.log('[status-updates] Completed events:', eventsCompleted);

    // Update tasks that are past due and still pending/in_progress
    const overdueTasks = await db
      .update(tasks)
      .set({
        status: 'overdue',
        updatedAt: now,
      })
      .where(
        and(
          lt(tasks.dueAt, now),
          or(
            eq(tasks.status, 'pending'),
            eq(tasks.status, 'in_progress')
          )
        )
      )
      .returning({ id: tasks.id });

    tasksMarkedOverdue = overdueTasks.length;

    console.log('[status-updates] Tasks marked overdue:', tasksMarkedOverdue);

    return {
      eventsCompleted,
      tasksMarkedOverdue,
    };
  } catch (error) {
    console.error('[status-updates] Failed:', error);
    throw error;
  }
}
