'use server';

import { getCurrentUserId } from '@/lib/auth';
import { t } from '@/lib/i18n/server-errors';
import { createPluggyConnectToken } from '@/lib/pluggy/client';
import { syncPluggyItem } from '@/lib/actions/pluggy-sync';

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
      transfersCreated: number;
      skipped: number;
    };
  }
  | { success: false; error: string };

export async function getPluggyConnectToken(itemId?: string): Promise<ActionResult> {
  try {
    const userId = await getCurrentUserId();
    const { token } = await createPluggyConnectToken(userId, itemId ? { itemId } : undefined);
    return { success: true, token };
  } catch (error) {
    console.error('[pluggy:connect-token] Failed:', error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: await t('errors.failedToCreate') };
  }
}

export async function syncPluggyItemById(pluggyItemId: string): Promise<SyncResult> {
  try {
    if (!pluggyItemId || !pluggyItemId.trim()) {
      return { success: false, error: await t('errors.failedToLoad') };
    }

    const result = await syncPluggyItem(pluggyItemId.trim());
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
