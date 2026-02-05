'use server';

import { db } from '@/lib/db';
import { billReminders, notificationJobs, userSettings } from '@/lib/schema';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { calculateNextDueDate } from '@/lib/utils/bill-reminders';

export async function scheduleBillReminderNotifications(): Promise<{
  scheduled: number;
  skipped: number;
}> {
  let scheduled = 0;
  let skipped = 0;

  // Get all active bill reminders
  const activeReminders = await db
    .select({
      reminder: billReminders,
      timezone: userSettings.timezone,
    })
    .from(billReminders)
    .leftJoin(userSettings, eq(userSettings.userId, billReminders.userId))
    .where(eq(billReminders.status, 'active'));

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const graceWindowMs = 24 * 60 * 60 * 1000;

  const reminderIds = activeReminders.map(({ reminder }) => reminder.id);
  const earliestScheduledAt = new Date(now.getTime() - graceWindowMs);

  const existingJobKeys = new Set<string>();
  if (reminderIds.length > 0) {
    const existingJobs = await db
      .select({ itemId: notificationJobs.itemId, scheduledAt: notificationJobs.scheduledAt })
      .from(notificationJobs)
      .where(
        and(
          eq(notificationJobs.itemType, 'bill_reminder'),
          inArray(notificationJobs.itemId, reminderIds),
          eq(notificationJobs.status, 'pending'),
          gte(notificationJobs.scheduledAt, earliestScheduledAt),
          lte(notificationJobs.scheduledAt, sevenDaysFromNow)
        )
      );

    for (const job of existingJobs) {
      existingJobKeys.add(`${job.itemId}:${job.scheduledAt.toISOString()}`);
    }
  }

  for (const { reminder, timezone } of activeReminders) {
    try {
      const timeZone = timezone || 'UTC';
      const nextDue = calculateNextDueDate(reminder, { now, timeZone, graceWindowMs });

      // Only schedule if within next 7 days
      if (nextDue > sevenDaysFromNow) {
        continue;
      }

      const shouldSchedule = (scheduledAt: Date) =>
        scheduledAt > now || now.getTime() - scheduledAt.getTime() <= graceWindowMs;

      const notifications: Array<{ offset: number; scheduledAt: Date }> = [];

      if (reminder.notify2DaysBefore) {
        const scheduledAt = new Date(nextDue.getTime() - 2 * 24 * 60 * 60 * 1000);
        if (shouldSchedule(scheduledAt)) {
          notifications.push({ offset: -2880, scheduledAt });
        }
      }

      if (reminder.notify1DayBefore) {
        const scheduledAt = new Date(nextDue.getTime() - 1 * 24 * 60 * 60 * 1000);
        if (shouldSchedule(scheduledAt)) {
          notifications.push({ offset: -1440, scheduledAt });
        }
      }

      if (reminder.notifyOnDueDay) {
        const scheduledAt = nextDue;
        if (shouldSchedule(scheduledAt)) {
          notifications.push({ offset: 0, scheduledAt });
        }
      }

      // Create notification jobs
      for (const notification of notifications) {
        const jobKey = `${reminder.id}:${notification.scheduledAt.toISOString()}`;
        if (existingJobKeys.has(jobKey)) {
          skipped++;
          continue;
        }

        // Create new job
        await db.insert(notificationJobs).values({
          itemType: 'bill_reminder',
          itemId: reminder.id,
          channel: 'email',
          scheduledAt: notification.scheduledAt,
          status: 'pending',
          attempts: 0,
        });

        existingJobKeys.add(jobKey);
        scheduled++;
      }
    } catch (error) {
      console.error('[bill-reminder-jobs:schedule] Failed:', error, {
        reminderId: reminder.id,
        reminderName: reminder.name,
      });
    }
  }

  console.log('[bill-reminder-jobs:schedule] Completed:', {
    scheduled,
    skipped,
    totalReminders: activeReminders.length,
  });

  return { scheduled, skipped };
}
