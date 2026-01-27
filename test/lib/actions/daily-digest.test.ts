import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import { TEST_USER_ID } from '@/test/fixtures';
import * as schema from '@/lib/schema';

const { sendEmailMock, getDb, setDb } = vi.hoisted(() => {
  let testDb: ReturnType<typeof getTestDb>;
  return {
    sendEmailMock: vi.fn(),
    getDb: () => testDb,
    setDb: (db: ReturnType<typeof getTestDb>) => {
      testDb = db;
    },
  };
});

vi.mock('@/lib/email/send', () => ({
  sendEmail: sendEmailMock,
}));

vi.mock('@/lib/db', () => ({
  get db() {
    return getDb();
  },
}));

import { sendAllDailyDigests } from '@/lib/actions/daily-digest';

let testDb: ReturnType<typeof getTestDb>;

describe('Daily Digest', () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    setDb(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function createTestCategory(userId: string, name: string, color: string = '#ff0000') {
    const [category] = await testDb
      .insert(schema.categories)
      .values({
        userId,
        name,
        color,
        icon: '🍕',
        type: 'expense',
      })
      .returning();
    return category;
  }

  async function createTestAccount(userId: string) {
    const [account] = await testDb
      .insert(schema.accounts)
      .values({
        userId,
        name: 'Test Account',
        type: 'checking',
        currentBalance: 100000,
        lastBalanceUpdate: new Date(),
      })
      .returning();
    return account;
  }

  async function createYesterdayExpense(
    userId: string,
    categoryId: number,
    accountId: number,
    amount: number,
    description: string
  ) {
    const [transaction] = await testDb
      .insert(schema.transactions)
      .values({
        userId,
        categoryId,
        description,
        totalAmount: amount,
        totalInstallments: 1,
      })
      .returning();

    await testDb.insert(schema.entries).values({
      userId,
      transactionId: transaction.id,
      accountId,
      amount,
      purchaseDate: '2026-01-31', // Yesterday from test time 2026-02-01
      faturaMonth: '2026-01',
      dueDate: '2026-02-10',
      installmentNumber: 1,
    });

    return transaction;
  }

  async function createBudget(userId: string, categoryId: number, yearMonth: string, amount: number) {
    await testDb.insert(schema.budgets).values({
      userId,
      categoryId,
      yearMonth,
      amount,
    });
  }

  it('skips users without notification email and aggregates counts', async () => {
    await testDb.insert(schema.userSettings).values({
      userId: 'no-email-user',
      notificationsEnabled: true,
    });

    const failCategory = await createTestCategory('fail-user', 'Food');
    const failAccount = await createTestAccount('fail-user');

    await testDb.insert(schema.userSettings).values({
      userId: 'fail-user',
      notificationEmail: 'fail@example.com',
      notificationsEnabled: true,
      timezone: 'UTC',
    });

    await createYesterdayExpense('fail-user', failCategory.id, failAccount.id, 5000, 'Lunch');

    await testDb.insert(schema.userSettings).values({
      userId: 'empty-user',
      notificationEmail: 'empty@example.com',
      notificationsEnabled: true,
      timezone: 'UTC',
    });

    const successCategory = await createTestCategory('success-user', 'Transport');
    const successAccount = await createTestAccount('success-user');

    await testDb.insert(schema.userSettings).values({
      userId: 'success-user',
      notificationEmail: 'success@example.com',
      notificationsEnabled: true,
      timezone: 'UTC',
    });

    await createYesterdayExpense('success-user', successCategory.id, successAccount.id, 3000, 'Uber');

    sendEmailMock.mockImplementation(async (options: { to: string }) => {
      if (options.to === 'fail@example.com') {
        return { success: false, error: 'boom' };
      }
      return { success: true };
    });

    const resultPromise = sendAllDailyDigests();
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    // fail-user attempts 2 times (initial + 1 retry), success-user attempts 1 time = 3 total calls
    expect(sendEmailMock).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({
      usersProcessed: 3,
      emailsSent: 2, // success-user + empty-user (no data but counted as success)
      emailsFailed: 1, // fail-user
    });
  });

  it('considers empty day a success without sending email', async () => {
    await testDb.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      notificationEmail: 'user@example.com',
      notificationsEnabled: true,
      timezone: 'UTC',
    });

    await testDb.insert(schema.billingSubscriptions).values({
      userId: TEST_USER_ID,
      planKey: 'pro',
      status: 'active',
    });

    const result = await sendAllDailyDigests();

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      usersProcessed: 1,
      emailsSent: 1, // Considered success but no email sent
      emailsFailed: 0,
    });
  });

  it('includes spending within user local day boundaries', async () => {
    await testDb.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      notificationEmail: 'user@example.com',
      notificationsEnabled: true,
      timezone: 'America/Sao_Paulo', // UTC-3
    });

    const category = await createTestCategory(TEST_USER_ID, 'Food');
    const account = await createTestAccount(TEST_USER_ID);

    // Create transaction for yesterday in São Paulo timezone
    // 2026-02-01 12:00 UTC = 2026-02-01 09:00 São Paulo
    // Yesterday in São Paulo = 2026-01-31
    const [transaction] = await testDb
      .insert(schema.transactions)
      .values({
        userId: TEST_USER_ID,
        categoryId: category.id,
        description: 'Local Day Expense',
        totalAmount: 5000,
        totalInstallments: 1,
      })
      .returning();

    await testDb.insert(schema.entries).values({
      userId: TEST_USER_ID,
      transactionId: transaction.id,
      accountId: account.id,
      amount: 5000,
      purchaseDate: '2026-01-31', // Yesterday in São Paulo
      faturaMonth: '2026-01',
      dueDate: '2026-02-10',
      installmentNumber: 1,
    });

    // Create transaction for day before yesterday (should not appear)
    const [oldTransaction] = await testDb
      .insert(schema.transactions)
      .values({
        userId: TEST_USER_ID,
        categoryId: category.id,
        description: 'Previous Day Expense',
        totalAmount: 3000,
        totalInstallments: 1,
      })
      .returning();

    await testDb.insert(schema.entries).values({
      userId: TEST_USER_ID,
      transactionId: oldTransaction.id,
      accountId: account.id,
      amount: 3000,
      purchaseDate: '2026-01-30', // Day before yesterday
      faturaMonth: '2026-01',
      dueDate: '2026-02-10',
      installmentNumber: 1,
    });

    sendEmailMock.mockResolvedValue({ success: true });

    await sendAllDailyDigests();

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const [options] = sendEmailMock.mock.calls[0];
    expect(options.html).toContain('Food'); // Category name
    expect(options.html).toContain('R$'); // Currency
    expect(options.html).not.toContain('Previous Day Expense');
  });

  it('includes budget alerts in digest', async () => {
    vi.setSystemTime(new Date('2026-02-15T12:00:00Z'));

    await testDb.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      notificationEmail: 'user@example.com',
      notificationsEnabled: true,
      timezone: 'UTC',
    });

    const category = await createTestCategory(TEST_USER_ID, 'Food');
    const account = await createTestAccount(TEST_USER_ID);

    // Create budget of 10000 cents (R$100)
    await createBudget(TEST_USER_ID, category.id, '2026-02', 10000);

    // Create spending of 9500 cents (95% of budget - critical)
    for (let i = 1; i <= 14; i++) {
      const [transaction] = await testDb
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          categoryId: category.id,
          description: `Expense ${i}`,
          totalAmount: 678,
          totalInstallments: 1,
        })
        .returning();

      await testDb.insert(schema.entries).values({
        userId: TEST_USER_ID,
        transactionId: transaction.id,
        accountId: account.id,
        amount: 678,
        purchaseDate: `2026-02-${String(i).padStart(2, '0')}`,
        faturaMonth: '2026-02',
        dueDate: '2026-03-10',
        installmentNumber: 1,
      });
    }

    sendEmailMock.mockResolvedValue({ success: true });

    await sendAllDailyDigests();

    const [options] = sendEmailMock.mock.calls[0];
    // Should include budget insights even without yesterday spending
    expect(options.html).toContain('Food'); // Category in budget warning
    expect(options.html).toMatch(/\d+%/); // Percentage
  });

  it('retries sendEmail failures with backoff', async () => {
    await testDb.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      notificationEmail: 'user@example.com',
      notificationsEnabled: true,
      timezone: 'UTC',
    });

    const category = await createTestCategory(TEST_USER_ID, 'Food');
    const account = await createTestAccount(TEST_USER_ID);

    await createYesterdayExpense(TEST_USER_ID, category.id, account.id, 5000, 'Retry Expense');

    sendEmailMock
      .mockResolvedValueOnce({ success: false, error: 'temporary' })
      .mockResolvedValueOnce({ success: true });

    const resultPromise = sendAllDailyDigests();
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      usersProcessed: 1,
      emailsSent: 1,
      emailsFailed: 0,
    });
  });
});
