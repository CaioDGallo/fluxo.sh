'use server';

import { db } from '@/lib/db';
import { transactions, entries, income, faturas, pluggyItems, pluggySyncCursors, pluggyWebhookEvents } from '@/lib/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { handleDbError } from '@/lib/db-errors';
import { reconcileAccountBalancesForUser } from '@/lib/actions/accounts';
import { getPostHogClient } from '@/lib/posthog-server';
import { checkDestructiveRateLimit } from '@/lib/rate-limit';

export async function resetAllTransactions(): Promise<
  | {
      success: true;
      deletedFaturas: number;
      deletedEntries: number;
      deletedTransactions: number;
      deletedIncome: number;
      accountsReconciled: number;
      pluggySyncCursorsCleared: number;
      pluggyWebhookEventsCleared: number;
      pluggyItemsReset: number;
    }
  | { success: false; error: string }
> {
  try {
    const userId = await getCurrentUserId();

    // Rate limiting (destructive operation - 3 per hour)
    const rateLimit = await checkDestructiveRateLimit(userId);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `Muitas requisições. Tente novamente em ${Math.ceil(rateLimit.retryAfter / 60)} minutos`,
      };
    }

    let deletedFaturas = 0;
    let deletedEntries = 0;
    let deletedTransactions = 0;
    let deletedIncome = 0;
    let accountsReconciled = 0;
    let deletedWebhookEvents = 0;
    let deletedSyncCursors = 0;
    let resetPluggyItems = 0;

    await db.transaction(async (tx) => {
      // 1. Acquire advisory lock to prevent webhook interference during reset
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId} || '_reset'))`);

      // 2. Delete webhook idempotency events (allows re-processing)
      const webhookEventsResult = await tx
        .delete(pluggyWebhookEvents)
        .where(eq(pluggyWebhookEvents.userId, userId))
        .returning({ id: pluggyWebhookEvents.id });
      deletedWebhookEvents = webhookEventsResult.length;

      // 3. Delete sync cursors (forces full re-sync from beginning)
      const syncCursorsResult = await tx
        .delete(pluggySyncCursors)
        .where(eq(pluggySyncCursors.userId, userId))
        .returning({ id: pluggySyncCursors.id });
      deletedSyncCursors = syncCursorsResult.length;

      // 4. Reset Pluggy item sync timestamps (keeps connections alive)
      const pluggyItemsResult = await tx
        .update(pluggyItems)
        .set({
          lastSyncedAt: null,
          errorCount: 0,
          lastError: null,
        })
        .where(eq(pluggyItems.userId, userId))
        .returning({ id: pluggyItems.id });
      resetPluggyItems = pluggyItemsResult.length;

      // 5. Delete income (independent)
      const incomeResult = await tx
        .delete(income)
        .where(eq(income.userId, userId))
        .returning({ id: income.id });
      deletedIncome = incomeResult.length;

      // 6. Delete entries (child of transactions)
      const entriesResult = await tx
        .delete(entries)
        .where(eq(entries.userId, userId))
        .returning({ id: entries.id });
      deletedEntries = entriesResult.length;

      // 7. Clear pluggyBillId to prevent constraint issues on re-sync
      await tx
        .update(faturas)
        .set({ pluggyBillId: null })
        .where(and(eq(faturas.userId, userId), isNotNull(faturas.pluggyBillId)));

      // 8. Delete faturas
      const faturasResult = await tx
        .delete(faturas)
        .where(eq(faturas.userId, userId))
        .returning({ id: faturas.id });
      deletedFaturas = faturasResult.length;

      // 9. Delete transactions (parent of entries)
      const transactionsResult = await tx
        .delete(transactions)
        .where(eq(transactions.userId, userId))
        .returning({ id: transactions.id });
      deletedTransactions = transactionsResult.length;

      // 10. Recalculate account balances
      const { updated } = await reconcileAccountBalancesForUser(userId, tx);
      accountsReconciled = updated;
    });

    // PostHog event tracking
    const posthog = getPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: userId,
        event: 'data_reset',
        properties: {
          deleted_faturas: deletedFaturas,
          deleted_entries: deletedEntries,
          deleted_transactions: deletedTransactions,
          deleted_income: deletedIncome,
          accounts_reconciled: accountsReconciled,
          pluggy_sync_cursors_cleared: deletedSyncCursors,
          pluggy_webhook_events_cleared: deletedWebhookEvents,
          pluggy_items_reset: resetPluggyItems,
        },
      });
    }

    revalidatePath('/expenses');
    revalidatePath('/income');
    revalidatePath('/dashboard');
    revalidatePath('/faturas');
    revalidatePath('/settings/accounts');

    return {
      success: true,
      deletedFaturas,
      deletedEntries,
      deletedTransactions,
      deletedIncome,
      accountsReconciled,
      pluggySyncCursorsCleared: deletedSyncCursors,
      pluggyWebhookEventsCleared: deletedWebhookEvents,
      pluggyItemsReset: resetPluggyItems,
    };
  } catch (error) {
    console.error('Failed to reset transactions:', error);
    const errorMessage = await handleDbError(error, 'errors.failedToDelete');
    return { success: false, error: errorMessage };
  }
}
