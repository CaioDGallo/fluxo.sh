import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID } from '@/test/fixtures';
import { eq } from 'drizzle-orm';

type ResetActions = typeof import('@/lib/actions/reset-transactions');

const OTHER_USER_ID = 'other-user-id';

describe('Reset Transactions Actions', () => {
  let db: ReturnType<typeof getTestDb>;

  let resetAllTransactions: ResetActions['resetAllTransactions'];

  let getCurrentUserIdMock: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({
      db,
    }));

    getCurrentUserIdMock = vi.fn().mockResolvedValue(TEST_USER_ID);
    vi.doMock('@/lib/auth', () => ({
      getCurrentUserId: getCurrentUserIdMock,
    }));

    vi.doMock('@/lib/rate-limit', () => ({
      checkDestructiveRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
      checkCrudRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
    }));

    const resetActions = await import('@/lib/actions/reset-transactions');
    resetAllTransactions = resetActions.resetAllTransactions;
  });

  afterAll(async () => {
    await teardownTestDb();
    vi.resetAllMocks();
  });

  beforeEach(async () => {
    await clearAllTables();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  describe('resetAllTransactions - Pluggy sync state cleanup', () => {
    it('should clear Pluggy sync cursors', async () => {
      // Setup: Create Pluggy data
      const [pluggyItem] = await db
        .insert(schema.pluggyItems)
        .values({
          userId: TEST_USER_ID,
          pluggyItemId: 'test-item-id',
          lastSyncedAt: new Date(),
          errorCount: 2,
          lastError: 'Some error',
        })
        .returning();

      await db.insert(schema.pluggySyncCursors).values({
        userId: TEST_USER_ID,
        itemId: pluggyItem.id,
        scope: 'transactions',
        cursor: 'test-cursor',
        lastSyncedAt: new Date(),
      });

      // Reset
      const result = await resetAllTransactions();

      // Verify success
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.pluggySyncCursorsCleared).toBe(1);

      // Verify cursors deleted
      const cursors = await db
        .select()
        .from(schema.pluggySyncCursors)
        .where(eq(schema.pluggySyncCursors.userId, TEST_USER_ID));
      expect(cursors).toHaveLength(0);
    });

    it('should clear Pluggy webhook events', async () => {
      // Setup: Create webhook event
      await db.insert(schema.pluggyWebhookEvents).values({
        userId: TEST_USER_ID,
        eventId: 'test-event-id',
        event: 'item/created',
        itemId: 'test-item-id',
      });

      // Reset
      const result = await resetAllTransactions();

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.pluggyWebhookEventsCleared).toBe(1);

      // Verify webhook events deleted
      const webhookEvents = await db
        .select()
        .from(schema.pluggyWebhookEvents)
        .where(eq(schema.pluggyWebhookEvents.userId, TEST_USER_ID));
      expect(webhookEvents).toHaveLength(0);
    });

    it('should reset Pluggy item sync timestamps', async () => {
      // Setup: Create Pluggy item with sync state
      await db.insert(schema.pluggyItems).values({
        userId: TEST_USER_ID,
        pluggyItemId: 'test-item-id-timestamps',
        lastSyncedAt: new Date(),
        errorCount: 5,
        lastError: 'Connection timeout',
      });

      // Reset
      const result = await resetAllTransactions();

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.pluggyItemsReset).toBe(1);

      // Verify item sync timestamps reset
      const items = await db
        .select()
        .from(schema.pluggyItems)
        .where(eq(schema.pluggyItems.userId, TEST_USER_ID));
      expect(items).toHaveLength(1);
      expect(items[0].lastSyncedAt).toBeNull();
      expect(items[0].errorCount).toBe(0);
      expect(items[0].lastError).toBeNull();
    });

    it('should preserve Pluggy items and accounts', async () => {
      // Setup: Create Pluggy item and account
      const [account] = await db
        .insert(schema.accounts)
        .values({
          userId: TEST_USER_ID,
          name: 'Pluggy Account',
          type: 'checking',
          source: 'pluggy',
          currentBalance: 0,
        })
        .returning();

      const [pluggyItem] = await db
        .insert(schema.pluggyItems)
        .values({
          userId: TEST_USER_ID,
          pluggyItemId: 'test-item-id-preserve',
          lastSyncedAt: new Date(),
        })
        .returning();

      await db.insert(schema.pluggyAccounts).values({
        userId: TEST_USER_ID,
        itemId: pluggyItem.id,
        pluggyAccountId: 'test-account-id',
        accountId: account.id,
        name: 'Pluggy Account',
        type: 'CHECKING',
      });

      // Reset
      const result = await resetAllTransactions();

      expect(result.success).toBe(true);

      // Verify Pluggy items still exist
      const items = await db
        .select()
        .from(schema.pluggyItems)
        .where(eq(schema.pluggyItems.userId, TEST_USER_ID));
      expect(items).toHaveLength(1);

      // Verify Pluggy accounts still exist
      const pluggyAccounts = await db
        .select()
        .from(schema.pluggyAccounts)
        .where(eq(schema.pluggyAccounts.userId, TEST_USER_ID));
      expect(pluggyAccounts).toHaveLength(1);

      // Verify accounts still exist
      const accounts = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.userId, TEST_USER_ID));
      expect(accounts).toHaveLength(1);
    });

    it('should clear pluggyBillId before deleting faturas', async () => {
      // Setup: Create fatura with pluggyBillId
      const [account] = await db
        .insert(schema.accounts)
        .values({
          userId: TEST_USER_ID,
          name: 'Credit Card',
          type: 'credit_card',
          source: 'pluggy',
          currentBalance: 0,
        })
        .returning();

      await db.insert(schema.faturas).values({
        userId: TEST_USER_ID,
        accountId: account.id,
        yearMonth: '2025-01',
        closingDate: new Date('2025-01-20'),
        dueDate: new Date('2025-02-10'),
        totalAmount: 5000,
        pluggyBillId: 'test-bill-id',
      });

      // Reset
      const result = await resetAllTransactions();

      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.deletedFaturas).toBe(1);

      // Verify faturas deleted
      const faturas = await db
        .select()
        .from(schema.faturas)
        .where(eq(schema.faturas.userId, TEST_USER_ID));
      expect(faturas).toHaveLength(0);
    });

    it('should not affect other users Pluggy data', async () => {
      // Setup: Create Pluggy data for both users
      await db.insert(schema.pluggyItems).values({
        userId: TEST_USER_ID,
        pluggyItemId: 'test-item',
        lastSyncedAt: new Date(),
      });

      await db.insert(schema.pluggyItems).values({
        userId: OTHER_USER_ID,
        pluggyItemId: 'other-item',
        lastSyncedAt: new Date(),
      });

      await db.insert(schema.pluggyWebhookEvents).values({
        userId: TEST_USER_ID,
        eventId: 'test-event',
        event: 'item/created',
      });

      await db.insert(schema.pluggyWebhookEvents).values({
        userId: OTHER_USER_ID,
        eventId: 'other-event',
        event: 'item/created',
      });

      // Reset TEST_USER_ID data
      const result = await resetAllTransactions();

      expect(result.success).toBe(true);
      if (!result.success) return;

      // Verify test user data cleaned/reset
      const testItems = await db
        .select()
        .from(schema.pluggyItems)
        .where(eq(schema.pluggyItems.userId, TEST_USER_ID));
      expect(testItems).toHaveLength(1);
      expect(testItems[0].lastSyncedAt).toBeNull();

      const testWebhooks = await db
        .select()
        .from(schema.pluggyWebhookEvents)
        .where(eq(schema.pluggyWebhookEvents.userId, TEST_USER_ID));
      expect(testWebhooks).toHaveLength(0);

      // Verify other user data preserved
      const otherItems = await db
        .select()
        .from(schema.pluggyItems)
        .where(eq(schema.pluggyItems.userId, OTHER_USER_ID));
      expect(otherItems).toHaveLength(1);
      expect(otherItems[0].lastSyncedAt).not.toBeNull();

      const otherWebhooks = await db
        .select()
        .from(schema.pluggyWebhookEvents)
        .where(eq(schema.pluggyWebhookEvents.userId, OTHER_USER_ID));
      expect(otherWebhooks).toHaveLength(1);
    });
  });
});
