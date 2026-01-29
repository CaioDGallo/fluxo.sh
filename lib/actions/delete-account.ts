'use server';

import { db } from '@/lib/db';
import {
  accounts,
  billReminders,
  billingCustomers,
  billingSubscriptions,
  budgetAlerts,
  budgets,
  calendarSources,
  categoryFrequency,
  categories,
  entries,
  events,
  faturas,
  fcmTokens,
  income,
  monthlyBudgets,
  notificationJobs,
  notifications,
  recurrenceRules,
  tasks,
  transactions,
  transfers,
  usageCounters,
  userSettings,
} from '@/lib/schema';
import { invites, users, waitlist } from '@/lib/auth-schema';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth';
import { handleDbError } from '@/lib/db-errors';
import { checkDestructiveRateLimit } from '@/lib/rate-limit';
import { t } from '@/lib/i18n/server-errors';

type DeleteAccountResult =
  | {
      success: true;
    }
  | {
      success: false;
      error: string;
    };

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'] as const;

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type StripeErrorLike = {
  type?: string;
  code?: string;
  statusCode?: number;
  param?: string;
};

async function deleteItemMetadata(
  tx: DbTransaction,
  itemType: 'event' | 'task' | 'bill_reminder',
  itemIds: number[]
) {
  if (itemIds.length === 0) return;

  await tx
    .delete(notificationJobs)
    .where(and(eq(notificationJobs.itemType, itemType), inArray(notificationJobs.itemId, itemIds)));

  await tx
    .delete(notifications)
    .where(and(eq(notifications.itemType, itemType), inArray(notifications.itemId, itemIds)));

  await tx
    .delete(recurrenceRules)
    .where(and(eq(recurrenceRules.itemType, itemType), inArray(recurrenceRules.itemId, itemIds)));
}

function isMissingStripeSubscription(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const stripeError = error as StripeErrorLike;
  return (
    stripeError.code === 'resource_missing' ||
    (stripeError.type === 'StripeInvalidRequestError' && stripeError.statusCode === 404 && stripeError.param === 'id')
  );
}

export async function deleteAccount(): Promise<DeleteAccountResult> {
  try {
    const userId = await getCurrentUserId();

    const rateLimit = await checkDestructiveRateLimit(userId);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: await t('errors.tooManyAttempts', { retryAfter: rateLimit.retryAfter }),
      };
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { email: true },
    });

    if (!user) {
      return {
        success: false,
        error: await t('errors.notAuthenticated'),
      };
    }

    const activeSubscriptions = await db
      .select({ stripeSubscriptionId: billingSubscriptions.stripeSubscriptionId })
      .from(billingSubscriptions)
      .where(
        and(
          eq(billingSubscriptions.userId, userId),
          inArray(billingSubscriptions.status, ACTIVE_SUBSCRIPTION_STATUSES),
          isNotNull(billingSubscriptions.stripeSubscriptionId)
        )
      );

    if (activeSubscriptions.length > 0) {
      if (!process.env.STRIPE_SECRET_KEY) {
        return {
          success: false,
          error: await t('dataSettings.deleteAccountBillingError'),
        };
      }

      const { stripe } = await import('@/lib/stripe');
      await Promise.all(
        activeSubscriptions.map(async (subscription) => {
          try {
            await stripe.subscriptions.cancel(subscription.stripeSubscriptionId!);
          } catch (error) {
            if (isMissingStripeSubscription(error)) return;
            throw error;
          }
        })
      );
    }

    const [eventRows, taskRows, reminderRows] = await Promise.all([
      db.select({ id: events.id }).from(events).where(eq(events.userId, userId)),
      db.select({ id: tasks.id }).from(tasks).where(eq(tasks.userId, userId)),
      db.select({ id: billReminders.id }).from(billReminders).where(eq(billReminders.userId, userId)),
    ]);

    const eventIds = eventRows.map((row) => row.id);
    const taskIds = taskRows.map((row) => row.id);
    const reminderIds = reminderRows.map((row) => row.id);

    await db.transaction(async (tx) => {
      await deleteItemMetadata(tx, 'event', eventIds);
      await deleteItemMetadata(tx, 'task', taskIds);
      await deleteItemMetadata(tx, 'bill_reminder', reminderIds);

      await tx.delete(billReminders).where(eq(billReminders.userId, userId));
      await tx.delete(tasks).where(eq(tasks.userId, userId));
      await tx.delete(events).where(eq(events.userId, userId));
      await tx.delete(calendarSources).where(eq(calendarSources.userId, userId));

      await tx.delete(fcmTokens).where(eq(fcmTokens.userId, userId));
      await tx.delete(usageCounters).where(eq(usageCounters.userId, userId));

      await tx.delete(transfers).where(eq(transfers.userId, userId));
      await tx.delete(income).where(eq(income.userId, userId));
      await tx.delete(entries).where(eq(entries.userId, userId));
      await tx.delete(faturas).where(eq(faturas.userId, userId));
      await tx.delete(transactions).where(eq(transactions.userId, userId));

      await tx.delete(budgets).where(eq(budgets.userId, userId));
      await tx.delete(budgetAlerts).where(eq(budgetAlerts.userId, userId));
      await tx.delete(monthlyBudgets).where(eq(monthlyBudgets.userId, userId));

      await tx.delete(categoryFrequency).where(eq(categoryFrequency.userId, userId));
      await tx.delete(categories).where(eq(categories.userId, userId));
      await tx.delete(accounts).where(eq(accounts.userId, userId));

      await tx.delete(userSettings).where(eq(userSettings.userId, userId));
      await tx.delete(billingSubscriptions).where(eq(billingSubscriptions.userId, userId));
      await tx.delete(billingCustomers).where(eq(billingCustomers.userId, userId));

      await tx.update(invites).set({ createdBy: null }).where(eq(invites.createdBy, userId));
      await tx.update(invites).set({ usedBy: null }).where(eq(invites.usedBy, userId));

      if (user.email) {
        await tx.delete(waitlist).where(eq(waitlist.email, user.email));
      }

      await tx.delete(users).where(eq(users.id, userId));
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to delete account:', error);
    const errorMessage = await handleDbError(error, 'errors.failedToDelete');
    return { success: false, error: errorMessage };
  }
}
