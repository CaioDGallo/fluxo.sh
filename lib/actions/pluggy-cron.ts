'use server';

import { db } from '@/lib/db';
import { requireCronAuth } from '@/lib/cron-auth';
import { syncPluggyItem } from '@/lib/actions/pluggy-sync';
import { pluggyItems, pluggyWebhookEvents } from '@/lib/schema';
import { and, asc, gt, isNull, lt, lte, or } from 'drizzle-orm';

export type PluggyCronResult = {
  processed: number;
  succeeded: number;
  failed: number;
};

const DEFAULT_BATCH_SIZE = 10;

export async function runPluggyCronSync(batchSize = DEFAULT_BATCH_SIZE): Promise<PluggyCronResult> {
  await requireCronAuth();

  const now = new Date();
  const dueItems = await db
    .select({
      pluggyItemId: pluggyItems.pluggyItemId,
      userId: pluggyItems.userId,
      nextSyncAt: pluggyItems.nextSyncAt,
    })
    .from(pluggyItems)
    .where(and(
      or(isNull(pluggyItems.nextSyncAt), lte(pluggyItems.nextSyncAt, now)),
      or(isNull(pluggyItems.consentExpiresAt), gt(pluggyItems.consentExpiresAt, now))
    ))
    .orderBy(asc(pluggyItems.nextSyncAt), asc(pluggyItems.createdAt))
    .limit(batchSize);

  let succeeded = 0;
  let failed = 0;

  for (const item of dueItems) {
    try {
      const result = await syncPluggyItem(item.pluggyItemId, item.userId, 'cron');
      if (result.success) {
        succeeded += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      console.error('[pluggy:cron] Sync failed:', error);
      failed += 1;
    }
  }

  console.log('[pluggy:cron] Completed', {
    processed: dueItems.length,
    succeeded,
    failed,
  });

  return {
    processed: dueItems.length,
    succeeded,
    failed,
  };
}

const WEBHOOK_EVENT_TTL_DAYS = 30;

export async function cleanupWebhookEvents(): Promise<{ deleted: number }> {
  await requireCronAuth();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - WEBHOOK_EVENT_TTL_DAYS);

  const deleted = await db
    .delete(pluggyWebhookEvents)
    .where(lt(pluggyWebhookEvents.createdAt, cutoff))
    .returning({ id: pluggyWebhookEvents.id });

  const count = deleted.length;
  if (count > 0) {
    console.log(`[pluggy:cron] Cleaned up ${count} webhook events older than ${WEBHOOK_EVENT_TTL_DAYS} days`);
  }

  return { deleted: count };
}
