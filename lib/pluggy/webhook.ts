import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { pluggyItems, pluggyWebhookEvents } from '@/lib/schema';
import { getPluggyClient } from '@/lib/pluggy/sdk';
import type { Item, WebhookEventPayload } from 'pluggy-sdk';
import { syncPluggyItem } from '@/lib/actions/pluggy-sync';
import { assertOpenFinanceAccess } from '@/lib/pluggy/guards';

export type PluggyWebhookPayload = {
  event?: WebhookEventPayload['event'];
  eventId?: string;
  itemId?: string;
  accountId?: string;
  transactionIds?: string[];
  clientUserId?: string;
};

const ITEM_SYNC_EVENTS = new Set(['item/created', 'item/updated', 'item/login_succeeded']);
const ITEM_ERROR_EVENTS = new Set([
  'item/error',
  'item/waiting_user_input',
  'item/login_required',
  'item/consent_expired',
  'item/deleted',
]);
const TRANSACTION_EVENTS = new Set([
  'transactions/created',
  'transactions/updated',
  'transactions/deleted',
]);

function parseIsoDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function resolveUserId(itemId?: string, clientUserId?: string): Promise<string | null> {
  if (itemId) {
    const [item] = await db
      .select({ userId: pluggyItems.userId })
      .from(pluggyItems)
      .where(eq(pluggyItems.pluggyItemId, itemId))
      .limit(1);
    if (item?.userId) return item.userId;
  }

  if (clientUserId && clientUserId.trim()) {
    return clientUserId.trim();
  }

  return null;
}

async function recordWebhookEvent(payload: { event: string; eventId: string; itemId?: string | null }) {
  const [record] = await db
    .insert(pluggyWebhookEvents)
    .values({
      eventId: payload.eventId,
      event: payload.event,
      itemId: payload.itemId ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: pluggyWebhookEvents.id });

  return Boolean(record);
}

async function updateWebhookUser(eventId: string, userId: string) {
  await db
    .update(pluggyWebhookEvents)
    .set({ userId })
    .where(eq(pluggyWebhookEvents.eventId, eventId));
}

async function handleItemEvent(payload: PluggyWebhookPayload, userId: string) {
  const itemId = payload.itemId;
  if (!itemId) return;

  const now = new Date();
  let itemPayload: Item | null = null;

  try {
    itemPayload = await getPluggyClient().fetchItem(itemId);
  } catch (error) {
    console.error('[pluggy:webhook] Failed to fetch item:', error);
  }

  const lastUpdatedAt = itemPayload?.lastUpdatedAt ? parseIsoDate(itemPayload.lastUpdatedAt) : null;
  const statusDetail = itemPayload?.error?.message ?? itemPayload?.executionStatus ?? null;
  const connectorId = itemPayload?.connector?.id ? String(itemPayload.connector.id) : null;
  const isErrorEvent = payload.event ? ITEM_ERROR_EVENTS.has(payload.event) : false;

  const itemValues: Partial<typeof pluggyItems.$inferInsert> = {
    userId,
    pluggyItemId: itemId,
    updatedAt: now,
    ...(payload.clientUserId ? { clientUserId: payload.clientUserId } : {}),
  };

  const itemUpdate: Partial<typeof pluggyItems.$inferInsert> = {
    updatedAt: now,
    ...(payload.clientUserId ? { clientUserId: payload.clientUserId } : {}),
  };

  if (isErrorEvent) {
    Object.assign(itemValues, {
      lastError: statusDetail ?? payload.event ?? 'item/error',
      errorCount: 1,
    });
    Object.assign(itemUpdate, {
      lastError: statusDetail ?? payload.event ?? 'item/error',
      errorCount: sql`${pluggyItems.errorCount} + 1`,
    });
  }

  if (itemPayload) {
    Object.assign(itemValues, {
      connectorId,
      status: itemPayload.status ?? null,
      statusDetail: statusDetail ?? null,
      lastUpdatedAt,
    });

    Object.assign(itemUpdate, {
      connectorId,
      status: itemPayload.status ?? null,
      statusDetail: statusDetail ?? null,
      lastUpdatedAt,
    });
  }

  await db
    .insert(pluggyItems)
    .values(itemValues as typeof pluggyItems.$inferInsert)
    .onConflictDoUpdate({
      target: [pluggyItems.userId, pluggyItems.pluggyItemId],
      set: itemUpdate,
    });

  if (payload.event && ITEM_SYNC_EVENTS.has(payload.event)) {
    void syncPluggyItem(itemId, userId, 'webhook').catch((error) => {
      console.error('[pluggy:webhook] Failed to sync item:', error);
    });
  }
}

async function handleTransactionsEvent(payload: PluggyWebhookPayload, userId: string) {
  const itemId = payload.itemId;
  if (!itemId) return;
  void syncPluggyItem(itemId, userId, 'webhook').catch((error) => {
    console.error('[pluggy:webhook] Failed to sync transactions:', error);
  });
}

export async function processPluggyWebhook(payload: PluggyWebhookPayload) {
  const event = payload.event?.trim() as PluggyWebhookPayload['event'] | undefined;
  const eventId = payload.eventId?.trim();
  if (!event || !eventId) {
    throw new Error('Missing event or eventId');
  }

  const shouldProcess = await recordWebhookEvent({
    event,
    eventId,
    itemId: payload.itemId ?? null,
  });

  if (!shouldProcess) {
    return { ignored: true };
  }

  const userId = await resolveUserId(payload.itemId, payload.clientUserId);
  if (userId) {
    await updateWebhookUser(eventId, userId);
    try {
      await assertOpenFinanceAccess(userId);
    } catch {
      return { ignored: true };
    }
  }

  if (event.startsWith('item/')) {
    if (userId) {
      await handleItemEvent({ ...payload, event, eventId }, userId);
    }
    return { processed: true };
  }

  if (TRANSACTION_EVENTS.has(event)) {
    if (userId) {
      await handleTransactionsEvent({ ...payload, event, eventId }, userId);
    }
    return { processed: true };
  }

  return { processed: false };
}
