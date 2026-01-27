import { db } from '@/lib/db';
import { usageCounters, userSettings } from '@/lib/schema';
import { and, eq, sql } from 'drizzle-orm';

export type UsageKey = 'import_weekly';

export type UsageWindow = {
  periodStart: string;
  periodEnd: string;
};

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getWeeklyWindow(timezone: string, now = new Date()): UsageWindow {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const [year, month, day] = formatter.format(now).split('-').map(Number);
  const localDate = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = localDate.getUTCDay();
  const diffToMonday = (dayOfWeek + 6) % 7;

  const start = new Date(localDate);
  start.setUTCDate(localDate.getUTCDate() - diffToMonday);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return {
    periodStart: formatDate(start),
    periodEnd: formatDate(end),
  };
}

export async function getUserTimezone(userId: string): Promise<string> {
  const [settings] = await db
    .select({ timezone: userSettings.timezone })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return settings?.timezone || 'UTC';
}

export async function getUsageCount(
  userId: string,
  key: UsageKey,
  window: UsageWindow
): Promise<number> {
  const [record] = await db
    .select({ count: usageCounters.count })
    .from(usageCounters)
    .where(
      and(
        eq(usageCounters.userId, userId),
        eq(usageCounters.key, key),
        eq(usageCounters.periodStart, window.periodStart),
        eq(usageCounters.periodEnd, window.periodEnd)
      )
    )
    .limit(1);

  return record?.count ?? 0;
}

export async function incrementUsageCount(
  userId: string,
  key: UsageKey,
  window: UsageWindow,
  incrementBy = 1
): Promise<number> {
  const [record] = await db
    .insert(usageCounters)
    .values({
      userId,
      key,
      periodStart: window.periodStart,
      periodEnd: window.periodEnd,
      count: incrementBy,
    })
    .onConflictDoUpdate({
      target: [
        usageCounters.userId,
        usageCounters.key,
        usageCounters.periodStart,
        usageCounters.periodEnd,
      ],
      set: {
        count: sql`${usageCounters.count} + ${incrementBy}`,
        updatedAt: new Date(),
      },
    })
    .returning({ count: usageCounters.count });

  return record?.count ?? incrementBy;
}
