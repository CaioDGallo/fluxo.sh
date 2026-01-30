'use server';

import { db } from '@/lib/db';
import { billingSubscriptions } from '@/lib/schema';
import { users } from '@/lib/auth-schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { sendBillingEmail, getUserLocale } from '@/lib/email/billing-emails';
import {
  generateRenewalReminderHtml,
  generateRenewalReminderText,
} from '@/lib/email/renewal-reminder-template';
import { PLANS } from '@/lib/plans';

/**
 * Sends renewal reminder emails to users whose subscriptions will renew in 3 days.
 * Runs daily via cron job.
 */
export async function sendRenewalReminders() {
  console.log('[renewal-reminders] Starting');

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Calculate date range for "3 days from now"
  const startOfDay = new Date(threeDaysFromNow);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(threeDaysFromNow);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    // Find active subscriptions that will renew in 3 days
    const subscriptionsToRemind = await db
      .select({
        subscription: billingSubscriptions,
        user: users,
      })
      .from(billingSubscriptions)
      .innerJoin(users, eq(users.id, billingSubscriptions.userId))
      .where(
        and(
          eq(billingSubscriptions.status, 'active'),
          eq(billingSubscriptions.cancelAtPeriodEnd, false),
          gte(billingSubscriptions.currentPeriodEnd, startOfDay),
          lte(billingSubscriptions.currentPeriodEnd, endOfDay)
        )
      );

    console.log(
      `[renewal-reminders] Found ${subscriptionsToRemind.length} subscriptions to remind`
    );

    let sentCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const { subscription, user } of subscriptionsToRemind) {
      try {
        if (!user.email) {
          console.warn(`[renewal-reminders] User ${user.id} has no email`);
          skippedCount++;
          continue;
        }

        const locale = await getUserLocale(user.id);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fluxo.sh';
        const planName = PLANS[subscription.planKey as keyof typeof PLANS].name;
        const renewalDate = subscription.currentPeriodEnd
          ? new Intl.DateTimeFormat(locale, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }).format(subscription.currentPeriodEnd)
          : '';

        // Estimate amount from Stripe (we don't store price in DB)
        // For now, use a placeholder - in production, you'd fetch from Stripe
        const amountDisplay = 'R$ 29,90'; // TODO: fetch actual price from Stripe

        const html = generateRenewalReminderHtml({
          planName,
          renewalDate,
          amountDisplay,
          appUrl,
          locale,
        });
        const text = generateRenewalReminderText({
          planName,
          renewalDate,
          amountDisplay,
          appUrl,
          locale,
        });

        const result = await sendBillingEmail({
          userId: user.id,
          userEmail: user.email,
          emailType: 'renewal_reminder',
          referenceId: `${subscription.id}-${startOfDay.toISOString().split('T')[0]}`,
          subject:
            locale === 'pt-BR'
              ? 'Sua assinatura renova em breve'
              : 'Your subscription renews soon',
          html,
          text,
        });

        if (result.success) {
          if (result.alreadySent) {
            skippedCount++;
          } else {
            sentCount++;
          }
        } else {
          console.error(
            `[renewal-reminders] Failed to send to ${user.email}: ${result.error}`
          );
          errorCount++;
        }
      } catch (error) {
        console.error(`[renewal-reminders] Error processing user ${user.id}:`, error);
        errorCount++;
      }
    }

    console.log(
      `[renewal-reminders] Complete: ${sentCount} sent, ${skippedCount} skipped, ${errorCount} errors`
    );

    return { success: true, sent: sentCount, skipped: skippedCount, errors: errorCount };
  } catch (error) {
    console.error('[renewal-reminders] Failed:', error);
    return { success: false, error: String(error) };
  }
}
