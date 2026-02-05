'use server';

import { getCurrentUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { t } from '@/lib/i18n/server-errors';
import { getPluggyClient } from '@/lib/pluggy/sdk';
import type { Item } from 'pluggy-sdk';
import { syncPluggyItem } from '@/lib/actions/pluggy-sync';
import { batchUpdateFaturaTotals } from '@/lib/actions/faturas';
import { syncAccountBalance } from '@/lib/actions/accounts';
import { accounts, entries, faturas, income, pluggyAccounts, pluggyItems, transactions } from '@/lib/schema';
import { and, eq, inArray, like } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { ensurePluggyAccountMapping } from '@/lib/pluggy/accounts';
import { assertOpenFinanceAccess } from '@/lib/pluggy/guards';
import { checkPluggyConnectRateLimit, checkPluggyDisconnectRateLimit, checkPluggyManualSyncRateLimit } from '@/lib/rate-limit';

type ActionResult =
  | { success: true; token: string }
  | { success: false; error: string };

type SyncResult =
  | {
    success: true;
    result: {
      pluggyItemId: string;
      syncedAt: string;
      accountsSynced: number;
      accountsCreated: number;
      transactionsCreated: number;
      incomeCreated: number;
      skipped: number;
    };
  }
  | { success: false; error: string };

type DisconnectResult =
  | { success: true }
  | { success: false; error: string };

type InitializeAccountsResult =
  | {
    success: true;
    result: {
      pluggyItemId: string;
      accountsFound: number;
      accountsCreated: number;
      replacedManual: number;
    };
  }
  | { success: false; error: string };

function resolveAppUrl(): string | undefined {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!appUrl) return undefined;
  const trimmed = appUrl.replace(/\/$/, '');
  if (trimmed.startsWith('https://') || process.env.ENABLE_HTTP_WEBHOOK === 'true') {
    return trimmed;
  }
  return undefined;
}

function resolvePluggyWebhookUrl() {
  const appUrl = resolveAppUrl();
  if (!appUrl) return undefined;
  return `${appUrl}/api/webhooks/pluggy`;
}

function parseIsoDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function getPluggyConnectToken(itemId?: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    await assertOpenFinanceAccess(userId);
    const rateLimit = await checkPluggyConnectRateLimit(`${userId}:init`);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: await t('errors.tooManyAttempts', { retryAfter: rateLimit.retryAfter }),
      };
    }
    const webhookUrl = resolvePluggyWebhookUrl();
    const appUrl = resolveAppUrl();
    const oauthRedirectUri = appUrl ? `${appUrl}/auth/pluggy-callback` : undefined;
    const client = getPluggyClient();
    const { accessToken } = await client.createConnectToken(itemId, {
      clientUserId: userId,
      ...(webhookUrl ? { webhookUrl } : {}),
      ...(oauthRedirectUri ? { oauthRedirectUri } : {}),
    });
    return { success: true, token: accessToken };
  } catch (error) {
    console.error('[pluggy:connect-token] Failed:', error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: await t('errors.failedToCreate') };
  }
}

export async function initializePluggyItemAccounts(pluggyItemId: string): Promise<InitializeAccountsResult> {
  try {
    if (!pluggyItemId || !pluggyItemId.trim()) {
      return { success: false, error: await t('errors.failedToLoad') };
    }

    const userId = await getCurrentUserId();
    await assertOpenFinanceAccess(userId);
    const rateLimit = await checkPluggyConnectRateLimit(userId);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: await t('errors.tooManyAttempts', { retryAfter: rateLimit.retryAfter }),
      };
    }
    const normalizedId = pluggyItemId.trim();
    const now = new Date();

    const client = getPluggyClient();
    let itemPayload: Item | null = null;
    try {
      itemPayload = await client.fetchItem(normalizedId);
    } catch (error) {
      console.error('[pluggy:init] Failed to fetch item:', error);
    }

    const lastUpdatedAt = parseIsoDate(itemPayload?.lastUpdatedAt ?? null);
    const statusDetail = itemPayload?.error?.message ?? itemPayload?.executionStatus ?? null;
    const connectorId = itemPayload?.connector?.id ? String(itemPayload.connector.id) : null;

    const itemValues: Partial<typeof pluggyItems.$inferInsert> = {
      userId,
      pluggyItemId: normalizedId,
      clientUserId: userId,
      updatedAt: now,
      ...(itemPayload ? {
        connectorId,
        status: itemPayload.status ?? null,
        statusDetail,
        lastUpdatedAt,
      } : {}),
    };

    const itemUpdate: Partial<typeof pluggyItems.$inferInsert> = {
      clientUserId: userId,
      updatedAt: now,
      ...(itemPayload ? {
        connectorId,
        status: itemPayload.status ?? null,
        statusDetail,
        lastUpdatedAt,
      } : {}),
    };

    const [pluggyItemRow] = await db
      .insert(pluggyItems)
      .values(itemValues as typeof pluggyItems.$inferInsert)
      .onConflictDoUpdate({
        target: [pluggyItems.userId, pluggyItems.pluggyItemId],
        set: itemUpdate,
      })
      .returning({ id: pluggyItems.id });

    if (!pluggyItemRow) {
      throw new Error(await t('errors.failedToCreate'));
    }

    const { results: accountList } = await client.fetchAccounts(normalizedId);
    let accountsCreated = 0;
    let replacedManual = 0;

    for (const pluggyAccount of accountList) {
      const result = await ensurePluggyAccountMapping({
        userId,
        pluggyItemRowId: pluggyItemRow.id,
        pluggyAccount,
        itemPayload,
      });
      if (result.created) accountsCreated += 1;
      if (result.replacedManual) replacedManual += 1;
    }

    revalidatePath('/settings/open-finance');
    revalidatePath('/settings/accounts');

    return {
      success: true,
      result: {
        pluggyItemId: normalizedId,
        accountsFound: accountList.length,
        accountsCreated,
        replacedManual,
      },
    };
  } catch (error) {
    console.error('[pluggy:init] Failed:', error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: await t('errors.failedToLoad') };
  }
}

export async function disconnectPluggyItem(
  itemId: number,
  keepData: boolean
): Promise<DisconnectResult> {
  try {
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return { success: false, error: await t('errors.failedToLoad') };
    }

    const userId = await getCurrentUserId();
    await assertOpenFinanceAccess(userId);
    const rateLimit = await checkPluggyDisconnectRateLimit(userId);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: await t('errors.tooManyAttempts', { retryAfter: rateLimit.retryAfter }),
      };
    }
    const [item] = await db
      .select({ id: pluggyItems.id })
      .from(pluggyItems)
      .where(and(eq(pluggyItems.id, itemId), eq(pluggyItems.userId, userId)))
      .limit(1);

    if (!item) {
      return { success: false, error: await t('errors.failedToLoad') };
    }

    const accountRows = await db
      .select({ accountId: pluggyAccounts.accountId })
      .from(pluggyAccounts)
      .where(and(eq(pluggyAccounts.itemId, itemId), eq(pluggyAccounts.userId, userId)));

    const accountIds = accountRows
      .map((row) => row.accountId)
      .filter((id): id is number => Number.isInteger(id));

    await db.transaction(async (tx) => {
      if (accountIds.length > 0) {
        await tx
          .update(accounts)
          .set({ source: 'manual' })
          .where(and(eq(accounts.userId, userId), inArray(accounts.id, accountIds)));
      }

      if (!keepData && accountIds.length > 0) {
        const transactionRows = await tx
          .select({ id: transactions.id })
          .from(transactions)
          .innerJoin(entries, eq(entries.transactionId, transactions.id))
          .where(and(
            eq(transactions.userId, userId),
            inArray(entries.accountId, accountIds),
            like(transactions.externalId, 'pluggy:%')
          ))
          .groupBy(transactions.id);

        const transactionIds = transactionRows.map((row) => row.id);
        if (transactionIds.length > 0) {
          await tx
            .delete(transactions)
            .where(inArray(transactions.id, transactionIds));
        }

        await tx
          .delete(income)
          .where(and(
            eq(income.userId, userId),
            inArray(income.accountId, accountIds),
            like(income.externalId, 'pluggy:%')
          ));

      }

      await tx
        .delete(pluggyItems)
        .where(and(eq(pluggyItems.userId, userId), eq(pluggyItems.id, itemId)));
    });

    if (!keepData && accountIds.length > 0) {
      const faturaRows = await db
        .select({ accountId: faturas.accountId, yearMonth: faturas.yearMonth })
        .from(faturas)
        .where(inArray(faturas.accountId, accountIds));

      const monthsByAccount = new Map<number, Set<string>>();
      for (const row of faturaRows) {
        const set = monthsByAccount.get(row.accountId) ?? new Set();
        set.add(row.yearMonth);
        monthsByAccount.set(row.accountId, set);
      }

      for (const [accountId, months] of monthsByAccount.entries()) {
        await batchUpdateFaturaTotals(accountId, Array.from(months));
      }
    }

    for (const accountId of accountIds) {
      await syncAccountBalance(accountId, db, userId);
    }

    revalidatePath('/dashboard');
    revalidatePath('/expenses');
    revalidatePath('/income');
    revalidatePath('/faturas');
    revalidatePath('/settings/accounts');
    revalidatePath('/settings/open-finance');

    return { success: true };
  } catch (error) {
    console.error('[pluggy:disconnect] Failed:', error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: await t('errors.failedToDelete') };
  }
}

export async function syncPluggyItemById(pluggyItemId: string): Promise<SyncResult> {
  try {
    if (!pluggyItemId || !pluggyItemId.trim()) {
      return { success: false, error: await t('errors.failedToLoad') };
    }

    const userId = await getCurrentUserId();
    await assertOpenFinanceAccess(userId);

    // Check if this is a first sync (no lastSyncedAt) - bypass rate limiting for first sync
    const [existingItem] = await db
      .select({ lastSyncedAt: pluggyItems.lastSyncedAt })
      .from(pluggyItems)
      .where(and(eq(pluggyItems.userId, userId), eq(pluggyItems.pluggyItemId, pluggyItemId.trim())))
      .limit(1);

    const isFirstSync = !existingItem || !existingItem.lastSyncedAt;

    if (!isFirstSync) {
      const rateLimit = await checkPluggyManualSyncRateLimit(userId, pluggyItemId.trim());
      if (!rateLimit.allowed) {
        return {
          success: false,
          error: await t('errors.tooManyAttempts', { retryAfter: rateLimit.retryAfter }),
        };
      }
    }

    const result = await syncPluggyItem(pluggyItemId.trim(), undefined, 'manual');
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      result: {
        ...result,
        syncedAt: result.syncedAt.toISOString(),
      },
    };
  } catch (error) {
    console.error('[pluggy:sync-ui] Failed:', error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: await t('errors.failedToLoad') };
  }
}
