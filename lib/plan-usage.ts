import { db } from '@/lib/db';
import { usageCounters, userSettings } from '@/lib/schema';
import { users } from '@/lib/auth-schema';
import { and, eq, sql } from 'drizzle-orm';
import { getUserEntitlements } from '@/lib/plan-entitlements';
import { getPlanDefinition } from '@/lib/plans';
import { sendBillingEmail, getUserLocale } from '@/lib/email/billing-emails';
import { logError } from '@/lib/logger';
import { ErrorIds } from '@/constants/errorIds';
import {
  generateUsageWarningHtml,
  generateUsageWarningText,
} from '@/lib/email/usage-warning-template';
import {
  generateUsageLimitHtml,
  generateUsageLimitText,
} from '@/lib/email/usage-limit-template';

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
  // Get previous count before incrementing
  const previousCount = await getUsageCount(userId, key, window);

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

  const newCount = record?.count ?? incrementBy;

  // Check if we should send usage emails
  try {
    const entitlements = await getUserEntitlements(userId);
    const limit = entitlements.limits.importWeekly;

    const previousPercentage = Math.floor((previousCount / limit) * 100);
    const newPercentage = Math.floor((newCount / limit) * 100);

    // Get user email
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user?.email) return newCount;

    const locale = await getUserLocale(userId);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fluxo.sh';
    const planName = getPlanDefinition(entitlements.planKey).name;
    const featureName = locale === 'pt-BR' ? 'importações' : 'imports';

    // Send 80% warning email (only once when crossing threshold)
    if (previousPercentage < 80 && newPercentage >= 80 && newPercentage < 100) {
      const html = generateUsageWarningHtml({
        featureName,
        currentUsage: newCount,
        limit,
        percentage: 80,
        remaining: limit - newCount,
        appUrl,
        locale,
      });
      const text = generateUsageWarningText({
        featureName,
        currentUsage: newCount,
        limit,
        percentage: 80,
        remaining: limit - newCount,
        appUrl,
        locale,
      });

      await sendBillingEmail({
        userId,
        userEmail: user.email,
        emailType: 'usage_warning',
        referenceId: `${key}-${window.periodStart}-80`,
        subject:
          locale === 'pt-BR'
            ? `Alerta: 80% do limite de ${featureName} usado`
            : `Alert: 80% of ${featureName} limit used`,
        html,
        text,
      });
    }

    // Send 100% limit email (only once when reaching limit)
    if (previousPercentage < 100 && newPercentage >= 100) {
      const endDate = new Date(`${window.periodEnd}T23:59:59Z`);
      const nextWeekStart = new Date(endDate);
      nextWeekStart.setUTCDate(endDate.getUTCDate() + 1);
      const resetDate = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(nextWeekStart);

      const html = generateUsageLimitHtml({
        featureName,
        limit,
        planName,
        resetDate,
        appUrl,
        locale,
      });
      const text = generateUsageLimitText({
        featureName,
        limit,
        planName,
        resetDate,
        appUrl,
        locale,
      });

      await sendBillingEmail({
        userId,
        userEmail: user.email,
        emailType: 'usage_limit',
        referenceId: `${key}-${window.periodStart}-100`,
        subject:
          locale === 'pt-BR' ? `Limite de ${featureName} atingido` : `${featureName} limit reached`,
        html,
        text,
      });
    }
  } catch (error) {
    // Log but don't fail the increment operation if email sending fails
    logError(ErrorIds.BILLING_USAGE_EMAIL_FAILED, 'Failed to send usage threshold email', error, {
      userId,
      key,
      window,
    });
  }

  return newCount;
}
