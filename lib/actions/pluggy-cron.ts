'use server';

import { db } from '@/lib/db';
import { requireCronAuth } from '@/lib/cron-auth';
import { syncPluggyItem } from '@/lib/actions/pluggy-sync';
import { pluggyItems } from '@/lib/schema';
import { asc, isNull, lte, or } from 'drizzle-orm';

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
    .where(or(isNull(pluggyItems.nextSyncAt), lte(pluggyItems.nextSyncAt, now)))
    .orderBy(asc(pluggyItems.nextSyncAt), asc(pluggyItems.createdAt))
    .limit(batchSize);

  let succeeded = 0;
  let failed = 0;

  for (const item of dueItems) {
    try {
      const result = await syncPluggyItem(item.pluggyItemId, item.userId);
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
