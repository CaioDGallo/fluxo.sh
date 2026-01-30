'use server';

import { db } from '@/lib/db';
import { sentEmails, userSettings } from '@/lib/schema';
import { sendEmail } from '@/lib/email/send';
import { defaultLocale, type Locale } from '@/lib/i18n/config';
import { eq, and } from 'drizzle-orm';
import { logError } from '@/lib/logger';
import { ErrorIds } from '@/constants/errorIds';

export type BillingEmailType =
  | 'subscription_purchased'
  | 'payment_failed'
  | 'subscription_canceled'
  | 'subscription_ended'
  | 'payment_receipt'
  | 'renewal_reminder'
  | 'plan_changed'
  | 'usage_warning'
  | 'usage_limit'
  | 'founder_welcome';

interface BillingEmailOptions {
  userId: string;
  userEmail: string;
  emailType: BillingEmailType;
  referenceId: string; // subscriptionId, invoiceId, etc.
  subject: string;
  html: string;
  text: string;
}

interface SendBillingEmailResult {
  success: boolean;
  error?: string;
  alreadySent?: boolean;
}

/**
 * Gets user's locale from settings, falling back to default locale.
 * Exported for use by email template generators.
 */
export async function getUserLocale(userId: string): Promise<Locale> {
  try {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    return (settings?.locale as Locale) ?? defaultLocale;
  } catch (error) {
    logError(ErrorIds.DB_READ_FAILED, 'Failed to get user locale for billing email', error, { userId });
    return defaultLocale;
  }
}

/**
 * Sends a billing email with deduplication.
 *
 * Billing emails always send regardless of notificationsEnabled setting,
 * as they are transactional and legally required in many regions.
 *
 * Deduplication prevents duplicate sends when webhooks are retried.
 */
export async function sendBillingEmail(
  options: BillingEmailOptions
): Promise<SendBillingEmailResult> {
  const { userId, userEmail, emailType, referenceId, subject, html, text } = options;

  try {
    // Check if already sent (deduplication)
    const [existing] = await db
      .select()
      .from(sentEmails)
      .where(
        and(
          eq(sentEmails.userId, userId),
          eq(sentEmails.emailType, emailType),
          eq(sentEmails.referenceId, referenceId)
        )
      )
      .limit(1);

    if (existing) {
      console.log(
        `[billing-emails:send] Skipping duplicate email: ${emailType} for ${referenceId}`
      );
      return { success: true, alreadySent: true };
    }

    // Send email
    const result = await sendEmail({
      to: userEmail,
      subject,
      html,
      text,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Log sent email
    await db.insert(sentEmails).values({
      userId,
      emailType,
      referenceId,
    });

    console.log(
      `[billing-emails:send] Sent ${emailType} email to ${userEmail} (ref: ${referenceId})`
    );

    return { success: true };
  } catch (error) {
    logError(ErrorIds.BILLING_EMAIL_SEND_FAILED, 'Failed to send billing email', error, {
      userId,
      userEmail,
      emailType,
      referenceId,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send billing email',
    };
  }
}
