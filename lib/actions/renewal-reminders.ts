'use server';

import { db } from '@/lib/db';
import { billingSubscriptions } from '@/lib/schema';
import { users } from '@/lib/auth-schema';
import { and, eq, gte, lte } from 'drizzle-orm';
import { sendBillingEmail, getUserLocale } from '@/lib/email/billing-emails';
import {
  generateRenewalReminderHtml,
  generateRenewalReminderText,
} from '@/lib/email/renewal-reminder-template';
import { getPlanDefinition } from '@/lib/plans';
import { stripe } from '@/lib/stripe';
import { formatCurrencyWithLocale } from '@/lib/utils';
import { logError } from '@/lib/logger';
import { ErrorIds } from '@/constants/errorIds';

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
  startOfDay.setUTCHours(0, 0, 0, 0);

  const endOfDay = new Date(threeDaysFromNow);
  endOfDay.setUTCHours(23, 59, 59, 999);

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
        const planName = getPlanDefinition(subscription.planKey).name;
        const renewalDate = subscription.currentPeriodEnd
          ? new Intl.DateTimeFormat(locale, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }).format(subscription.currentPeriodEnd)
          : '';

        // Fetch actual price from Stripe
        let amountDisplay = '';
        if (subscription.stripeSubscriptionId) {
          try {
            const stripeSubscription = await stripe.subscriptions.retrieve(
              subscription.stripeSubscriptionId
            );
            const unitAmount = stripeSubscription.items.data[0]?.price?.unit_amount;
            if (unitAmount) {
              amountDisplay = formatCurrencyWithLocale(unitAmount, locale);
            }
          } catch (error) {
            logError(ErrorIds.BILLING_STRIPE_FETCH_FAILED, 'Failed to fetch subscription price from Stripe for renewal reminder', error, {
              subscriptionId: subscription.stripeSubscriptionId,
              userId: user.id,
            });
            // Fallback: use plan's default price if available
            // This ensures email is sent even if Stripe fetch fails
          }
        }

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
          logError(ErrorIds.BILLING_RENEWAL_REMINDER_FAILED, `Failed to send renewal reminder to ${user.email}`, result.error, {
            userId: user.id,
            subscriptionId: subscription.id,
          });
          errorCount++;
        }
      } catch (error) {
        logError(ErrorIds.BILLING_RENEWAL_REMINDER_FAILED, 'Error processing user for renewal reminder', error, {
          userId: user.id,
          subscriptionId: subscription.id,
        });
        errorCount++;
      }
    }

    console.log(
      `[renewal-reminders] Complete: ${sentCount} sent, ${skippedCount} skipped, ${errorCount} errors`
    );

    return { success: true, sent: sentCount, skipped: skippedCount, errors: errorCount };
  } catch (error) {
    logError(ErrorIds.BILLING_RENEWAL_REMINDER_FAILED, 'Renewal reminder cron job failed', error);
    return { success: false, error: String(error) };
  }
}
