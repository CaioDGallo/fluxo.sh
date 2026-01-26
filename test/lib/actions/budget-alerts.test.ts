import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import { testAccounts, testCategories, TEST_USER_ID } from '@/test/fixtures';
import * as schema from '@/lib/schema';
import { getCurrentYearMonth } from '@/lib/utils';
import { and, eq } from 'drizzle-orm';

type BudgetAlertActions = typeof import('@/lib/actions/budget-alerts');

describe('Budget Alerts', () => {
  let db: ReturnType<typeof getTestDb>;
  let checkBudgetAlerts: BudgetAlertActions['checkBudgetAlerts'];
  let sendPushToUserMock: ReturnType<typeof vi.fn>;
  let categoryId: number;
  let accountId: number;
  let currentMonth: string;

  beforeAll(async () => {
    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({
      db,
    }));

    sendPushToUserMock = vi.fn().mockResolvedValue({ sent: 1, failed: 0 });
    vi.doMock('@/lib/services/push-sender', () => ({
      sendPushToUser: sendPushToUserMock,
    }));

    const actions = await import('@/lib/actions/budget-alerts');
    checkBudgetAlerts = actions.checkBudgetAlerts;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    sendPushToUserMock.mockClear();

    const [category] = await db
      .insert(schema.categories)
      .values(testCategories.expense)
      .returning();

    const [account] = await db
      .insert(schema.accounts)
      .values(testAccounts.checking)
      .returning();

    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      pushNotificationsEnabled: true,
    });

    categoryId = category.id;
    accountId = account.id;
    currentMonth = getCurrentYearMonth();

    await db.insert(schema.budgets).values({
      userId: TEST_USER_ID,
      categoryId,
      yearMonth: currentMonth,
      amount: 10000,
    });
  });

  async function seedSpending(amount: number) {
    const [transaction] = await db
      .insert(schema.transactions)
      .values({
        userId: TEST_USER_ID,
        description: 'Budget transaction',
        totalAmount: amount,
        totalInstallments: 1,
        categoryId,
      })
      .returning();

    await db.insert(schema.entries).values({
      userId: TEST_USER_ID,
      transactionId: transaction.id,
      accountId,
      amount,
      purchaseDate: `${currentMonth}-05`,
      faturaMonth: currentMonth,
      dueDate: `${currentMonth}-10`,
      installmentNumber: 1,
    });
  }

  it('sends alert and records cooldown', async () => {
    await seedSpending(8500);

    const result = await checkBudgetAlerts(TEST_USER_ID, categoryId);

    expect(result.sent).toBe(true);
    expect(result.threshold).toBe(80);
    expect(sendPushToUserMock).toHaveBeenCalledTimes(1);

    const alerts = await db.select().from(schema.budgetAlerts);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      userId: TEST_USER_ID,
      categoryId,
      yearMonth: currentMonth,
      threshold: 80,
    });
  });

  it('throttles alerts within 6 hours', async () => {
    await seedSpending(8500);

    await checkBudgetAlerts(TEST_USER_ID, categoryId);

    const second = await checkBudgetAlerts(TEST_USER_ID, categoryId);
    expect(second.sent).toBe(false);
    expect(sendPushToUserMock).toHaveBeenCalledTimes(1);

    const cooldownCutoff = new Date(Date.now() - 7 * 60 * 60 * 1000);

    await db
      .update(schema.budgetAlerts)
      .set({ lastSentAt: cooldownCutoff })
      .where(
        and(
          eq(schema.budgetAlerts.userId, TEST_USER_ID),
          eq(schema.budgetAlerts.categoryId, categoryId),
          eq(schema.budgetAlerts.yearMonth, currentMonth),
          eq(schema.budgetAlerts.threshold, 80)
        )
      );

    const third = await checkBudgetAlerts(TEST_USER_ID, categoryId);
    expect(third.sent).toBe(true);
    expect(sendPushToUserMock).toHaveBeenCalledTimes(2);
  });
});
