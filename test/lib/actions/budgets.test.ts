import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import { mockAuth } from '@/test/auth-utils';
import * as schema from '@/lib/schema';
import { testCategories, testAccounts, TEST_USER_ID } from '@/test/fixtures';
import { eq, and } from 'drizzle-orm';

type BudgetActions = typeof import('@/lib/actions/budgets');

describe('Budget Actions - CRUD and Calculations', () => {
  let db: ReturnType<typeof getTestDb>;
  let categoryId1: number;
  let categoryId2: number;
  let accountId: number;

  // Dynamic imports after mocking
  let getBudgetsForMonth: BudgetActions['getBudgetsForMonth'];
  let upsertBudget: BudgetActions['upsertBudget'];
  let getMonthlyBudget: BudgetActions['getMonthlyBudget'];
  let upsertMonthlyBudget: BudgetActions['upsertMonthlyBudget'];
  let getBudgetsWithSpending: BudgetActions['getBudgetsWithSpending'];
  let copyBudgetsFromMonth: BudgetActions['copyBudgetsFromMonth'];

  const tMock = vi.fn(async (key: string) => key);

  beforeAll(async () => {
    db = await setupTestDb();

    // Mock the db module to use test database
    vi.doMock('@/lib/db', () => ({
      db,
    }));

    // Mock auth to prevent Next.js cookies() calls
    mockAuth();

    // Mock translations used in error paths
    vi.doMock('@/lib/i18n/server-errors', () => ({
      t: tMock,
    }));

    // Import actions after mocking
    const actions = await import('@/lib/actions/budgets');
    getBudgetsForMonth = actions.getBudgetsForMonth;
    upsertBudget = actions.upsertBudget;
    getMonthlyBudget = actions.getMonthlyBudget;
    upsertMonthlyBudget = actions.upsertMonthlyBudget;
    getBudgetsWithSpending = actions.getBudgetsWithSpending;
    copyBudgetsFromMonth = actions.copyBudgetsFromMonth;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();

    // Seed test data
    const [category1] = await db
      .insert(schema.categories)
      .values(testCategories.expense)
      .returning();

    const [category2] = await db
      .insert(schema.categories)
      .values({
        userId: TEST_USER_ID,
        name: 'Entertainment',
        color: '#3b82f6',
        type: 'expense',
      })
      .returning();

    const [account] = await db
      .insert(schema.accounts)
      .values(testAccounts.creditCard)
      .returning();

    categoryId1 = category1.id;
    categoryId2 = category2.id;
    accountId = account.id;
  });

  describe('getBudgetsForMonth', () => {
    it('returns all categories with budget info for the month', async () => {
      // Create budget for category1 only
      await upsertBudget(categoryId1, '2025-01', 50000);

      const result = await getBudgetsForMonth('2025-01');

      expect(result).toHaveLength(2);

      // Category with budget
      const cat1 = result.find((r) => r.categoryId === categoryId1);
      expect(cat1).toMatchObject({
        categoryName: 'Test Expense Category',
        budgetAmount: 50000,
      });
      expect(cat1?.budgetId).not.toBeNull();

      // Category without budget
      const cat2 = result.find((r) => r.categoryId === categoryId2);
      expect(cat2).toMatchObject({
        categoryName: 'Entertainment',
        budgetAmount: null,
      });
      expect(cat2?.budgetId).toBeNull();
    });

    it('returns empty array if user has no categories', async () => {
      await clearAllTables();
      const result = await getBudgetsForMonth('2025-01');
      expect(result).toHaveLength(0);
    });

    it('returns categories ordered by name', async () => {
      await db.insert(schema.categories).values({
        userId: TEST_USER_ID,
        name: 'Auto',
        color: '#111111',
        type: 'expense',
      });

      const result = await getBudgetsForMonth('2025-01');

      expect(result.map((r) => r.categoryName)).toEqual([
        'Auto',
        'Entertainment',
        'Test Expense Category',
      ]);
    });

    it('filters by userId correctly (user isolation)', async () => {
      // Create category for another user
      const [otherCategory] = await db
        .insert(schema.categories)
        .values({
          userId: 'other-user',
          name: 'Other User Category',
          color: '#111111',
          type: 'expense',
        })
        .returning();

      await db.insert(schema.budgets).values({
        userId: 'other-user',
        categoryId: otherCategory.id,
        yearMonth: '2025-01',
        amount: 10000,
      });

      const result = await getBudgetsForMonth('2025-01');

      // Should only return current user's categories
      expect(result).toHaveLength(2);
      expect(result.every((r) => r.categoryName !== 'Other User Category')).toBe(true);
    });

    it('only shows budgets for specified month', async () => {
      await upsertBudget(categoryId1, '2025-01', 50000);
      await upsertBudget(categoryId1, '2025-02', 60000);

      const jan = await getBudgetsForMonth('2025-01');
      const feb = await getBudgetsForMonth('2025-02');

      const janCat1 = jan.find((r) => r.categoryId === categoryId1);
      const febCat1 = feb.find((r) => r.categoryId === categoryId1);

      expect(janCat1?.budgetAmount).toBe(50000);
      expect(febCat1?.budgetAmount).toBe(60000);
    });
  });

  describe('upsertBudget - Happy Paths', () => {
    it('creates new budget for category+month', async () => {
      await upsertBudget(categoryId1, '2025-01', 50000);

      const result = await getBudgetsForMonth('2025-01');
      const cat1 = result.find((r) => r.categoryId === categoryId1);

      expect(cat1?.budgetAmount).toBe(50000);
    });

    it('updates existing budget for same category+month', async () => {
      await upsertBudget(categoryId1, '2025-01', 50000);
      await upsertBudget(categoryId1, '2025-01', 75000);

      const result = await getBudgetsForMonth('2025-01');
      const cat1 = result.find((r) => r.categoryId === categoryId1);

      expect(cat1?.budgetAmount).toBe(75000);

      // Verify no duplicates created
      const budgets = await db
        .select()
        .from(schema.budgets)
        .where(
          and(
            eq(schema.budgets.categoryId, categoryId1),
            eq(schema.budgets.yearMonth, '2025-01')
          )
        );
      expect(budgets).toHaveLength(1);
    });

    it('creates budget with amount 0 (allowed)', async () => {
      await upsertBudget(categoryId1, '2025-01', 0);

      const result = await getBudgetsForMonth('2025-01');
      const cat1 = result.find((r) => r.categoryId === categoryId1);

      expect(cat1?.budgetAmount).toBe(0);
    });

    it('verifies userId is auto-assigned', async () => {
      await upsertBudget(categoryId1, '2025-01', 50000);

      const [budget] = await db
        .select()
        .from(schema.budgets)
        .where(
          and(
            eq(schema.budgets.categoryId, categoryId1),
            eq(schema.budgets.yearMonth, '2025-01')
          )
        );

      expect(budget.userId).toBe(TEST_USER_ID);
    });

    it('enforces unique constraint (userId, categoryId, yearMonth)', async () => {
      await upsertBudget(categoryId1, '2025-01', 50000);
      await upsertBudget(categoryId1, '2025-01', 75000);

      const budgets = await db
        .select()
        .from(schema.budgets)
        .where(
          and(
            eq(schema.budgets.userId, TEST_USER_ID),
            eq(schema.budgets.categoryId, categoryId1),
            eq(schema.budgets.yearMonth, '2025-01')
          )
        );

      expect(budgets).toHaveLength(1);
      expect(budgets[0].amount).toBe(75000);
    });
  });

  describe('upsertBudget - Edge Cases and Errors', () => {
    it('rejects invalid categoryId', async () => {
      await expect(upsertBudget(0, '2025-01', 50000)).rejects.toThrow();
      await expect(upsertBudget(-1, '2025-01', 50000)).rejects.toThrow();
    });

    it('rejects invalid yearMonth format', async () => {
      await expect(upsertBudget(categoryId1, '2025', 50000)).rejects.toThrow();
      await expect(upsertBudget(categoryId1, '202501', 50000)).rejects.toThrow();
      await expect(upsertBudget(categoryId1, '2025-1', 50000)).rejects.toThrow();
      await expect(upsertBudget(categoryId1, 'invalid', 50000)).rejects.toThrow(
        'errors.invalidYearMonthFormat'
      );
    });

    it('rejects negative amounts', async () => {
      await expect(upsertBudget(categoryId1, '2025-01', -100)).rejects.toThrow(
        'errors.budgetMustBeNonNegative'
      );
    });

    it('rejects non-integer amounts', async () => {
      await expect(upsertBudget(categoryId1, '2025-01', 50.5)).rejects.toThrow();
    });

    it('allows future months', async () => {
      await upsertBudget(categoryId1, '2026-12', 50000);
      const result = await getBudgetsForMonth('2026-12');
      expect(result.find((r) => r.categoryId === categoryId1)?.budgetAmount).toBe(50000);
    });

    it('allows past months', async () => {
      await upsertBudget(categoryId1, '2020-01', 50000);
      const result = await getBudgetsForMonth('2020-01');
      expect(result.find((r) => r.categoryId === categoryId1)?.budgetAmount).toBe(50000);
    });
  });

  describe('getMonthlyBudget / upsertMonthlyBudget', () => {
    it('returns null if no monthly budget set', async () => {
      const result = await getMonthlyBudget('2025-01');
      expect(result).toBeNull();
    });

    it('creates new monthly budget', async () => {
      await upsertMonthlyBudget('2025-01', 100000);

      const result = await getMonthlyBudget('2025-01');
      expect(result).toBe(100000);
    });

    it('updates existing monthly budget', async () => {
      await upsertMonthlyBudget('2025-01', 100000);
      await upsertMonthlyBudget('2025-01', 150000);

      const result = await getMonthlyBudget('2025-01');
      expect(result).toBe(150000);

      // Verify no duplicates
      const budgets = await db
        .select()
        .from(schema.monthlyBudgets)
        .where(
          and(
            eq(schema.monthlyBudgets.userId, TEST_USER_ID),
            eq(schema.monthlyBudgets.yearMonth, '2025-01')
          )
        );
      expect(budgets).toHaveLength(1);
    });

    it('allows amount 0', async () => {
      await upsertMonthlyBudget('2025-01', 0);
      const result = await getMonthlyBudget('2025-01');
      expect(result).toBe(0);
    });

    it('filters by userId correctly', async () => {
      await db.insert(schema.monthlyBudgets).values({
        userId: 'other-user',
        yearMonth: '2025-01',
        amount: 200000,
      });

      const result = await getMonthlyBudget('2025-01');
      expect(result).toBeNull();
    });

    it('rejects invalid yearMonth format', async () => {
      await expect(upsertMonthlyBudget('2025', 100000)).rejects.toThrow();
      await expect(getMonthlyBudget('invalid')).rejects.toThrow();
    });

    it('rejects negative amounts', async () => {
      await expect(upsertMonthlyBudget('2025-01', -100)).rejects.toThrow(
        'errors.monthlyBudgetMustBeNonNegative'
      );
    });
  });

  describe('getBudgetsWithSpending - Happy Paths', () => {
    beforeEach(async () => {
      // Create budgets
      await upsertBudget(categoryId1, '2025-01', 50000);
      await upsertBudget(categoryId2, '2025-01', 30000);
    });

    it('returns budgets with spending data', async () => {
      // Create transactions with entries
      const [tx1] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Groceries',
          totalAmount: 20000,
          totalInstallments: 1,
          categoryId: categoryId1,
        })
        .returning();

      await db.insert(schema.entries).values({
        userId: TEST_USER_ID,
        transactionId: tx1.id,
        accountId,
        amount: 20000,
        purchaseDate: '2025-01-15',
        faturaMonth: '2025-01',
        dueDate: '2025-01-15',
        installmentNumber: 1,
        paidAt: null,
      });

      const result = await getBudgetsWithSpending('2025-01');

      expect(result.totalBudget).toBe(80000);
      expect(result.totalSpent).toBe(20000);
      expect(result.budgets).toHaveLength(2);

      const cat1Budget = result.budgets.find((b) => b.categoryId === categoryId1);
      expect(cat1Budget).toMatchObject({
        categoryName: 'Test Expense Category',
        spent: 20000,
        budget: 50000,
      });

      const cat2Budget = result.budgets.find((b) => b.categoryId === categoryId2);
      expect(cat2Budget).toMatchObject({
        categoryName: 'Entertainment',
        spent: 0,
        budget: 30000,
      });
    });

    it('calculates totalSpent correctly (sum of all category spending)', async () => {
      const [tx1] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Expense 1',
          totalAmount: 15000,
          totalInstallments: 1,
          categoryId: categoryId1,
        })
        .returning();

      const [tx2] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Expense 2',
          totalAmount: 10000,
          totalInstallments: 1,
          categoryId: categoryId2,
        })
        .returning();

      await db.insert(schema.entries).values([
        {
          userId: TEST_USER_ID,
          transactionId: tx1.id,
          accountId,
          amount: 15000,
          purchaseDate: '2025-01-10',
          faturaMonth: '2025-01',
          dueDate: '2025-01-10',
          installmentNumber: 1,
          paidAt: null,
        },
        {
          userId: TEST_USER_ID,
          transactionId: tx2.id,
          accountId,
          amount: 10000,
          purchaseDate: '2025-01-20',
          faturaMonth: '2025-01',
          dueDate: '2025-01-20',
          installmentNumber: 1,
          paidAt: null,
        },
      ]);

      const result = await getBudgetsWithSpending('2025-01');
      expect(result.totalSpent).toBe(25000);
    });

    it('filters by purchaseDate (budget impact), NOT dueDate', async () => {
      const [tx] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Test',
          totalAmount: 20000,
          totalInstallments: 1,
          categoryId: categoryId1,
        })
        .returning();

      // Purchase in Jan but due in Feb
      await db.insert(schema.entries).values({
        userId: TEST_USER_ID,
        transactionId: tx.id,
        accountId,
        amount: 20000,
        purchaseDate: '2025-01-15',
        faturaMonth: '2025-02',
        dueDate: '2025-02-15',
        installmentNumber: 1,
        paidAt: null,
      });

      const janResult = await getBudgetsWithSpending('2025-01');
      const febResult = await getBudgetsWithSpending('2025-02');

      // Should appear in Jan budget (purchaseDate month)
      expect(janResult.totalSpent).toBe(20000);
      expect(febResult.totalSpent).toBe(0);
    });

    it('handles categories with budgets but no spending (spent=0)', async () => {
      const result = await getBudgetsWithSpending('2025-01');

      const cat1 = result.budgets.find((b) => b.categoryId === categoryId1);
      expect(cat1?.spent).toBe(0);
      expect(cat1?.budget).toBe(50000);
    });

    it('handles multiple entries in same category (sum correctly)', async () => {
      const [tx] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Multi-installment',
          totalAmount: 30000,
          totalInstallments: 3,
          categoryId: categoryId1,
        })
        .returning();

      // Create 3 entries for different months
      await db.insert(schema.entries).values([
        {
          userId: TEST_USER_ID,
          transactionId: tx.id,
          accountId,
          amount: 10000,
          purchaseDate: '2025-01-15',
          faturaMonth: '2025-01',
          dueDate: '2025-02-15',
          installmentNumber: 1,
          paidAt: null,
        },
        {
          userId: TEST_USER_ID,
          transactionId: tx.id,
          accountId,
          amount: 10000,
          purchaseDate: '2025-02-15',
          faturaMonth: '2025-02',
          dueDate: '2025-03-15',
          installmentNumber: 2,
          paidAt: null,
        },
        {
          userId: TEST_USER_ID,
          transactionId: tx.id,
          accountId,
          amount: 10000,
          purchaseDate: '2025-03-15',
          faturaMonth: '2025-03',
          dueDate: '2025-04-15',
          installmentNumber: 3,
          paidAt: null,
        },
      ]);

      const janResult = await getBudgetsWithSpending('2025-01');
      expect(janResult.totalSpent).toBe(10000); // Only first installment
    });

    it('filters by userId (user isolation)', async () => {
      const [otherCategory] = await db
        .insert(schema.categories)
        .values({
          userId: 'other-user',
          name: 'Other Category',
          color: '#111111',
          type: 'expense',
        })
        .returning();

      await db.insert(schema.budgets).values({
        userId: 'other-user',
        categoryId: otherCategory.id,
        yearMonth: '2025-01',
        amount: 50000,
      });

      const [otherAccount] = await db
        .insert(schema.accounts)
        .values({
          userId: 'other-user',
          name: 'Other Account',
          type: 'checking',
        })
        .returning();

      const [otherTx] = await db
        .insert(schema.transactions)
        .values({
          userId: 'other-user',
          description: 'Other Expense',
          totalAmount: 10000,
          totalInstallments: 1,
          categoryId: otherCategory.id,
        })
        .returning();

      await db.insert(schema.entries).values({
        userId: 'other-user',
        transactionId: otherTx.id,
        accountId: otherAccount.id,
        amount: 10000,
        purchaseDate: '2025-01-15',
        faturaMonth: '2025-01',
        dueDate: '2025-01-15',
        installmentNumber: 1,
        paidAt: null,
      });

      const result = await getBudgetsWithSpending('2025-01');

      // Should not include other user's data
      expect(result.budgets).toHaveLength(2);
      expect(result.totalSpent).toBe(0);
      expect(result.totalBudget).toBe(80000);
    });
  });

  describe('getBudgetsWithSpending - Edge Cases', () => {
    it('returns zero spending when no entries for month', async () => {
      await upsertBudget(categoryId1, '2025-01', 50000);

      const result = await getBudgetsWithSpending('2025-01');
      expect(result.totalSpent).toBe(0);
      expect(result.totalBudget).toBe(50000);
    });

    it('rejects invalid yearMonth format', async () => {
      await expect(getBudgetsWithSpending('2025')).rejects.toThrow();
      await expect(getBudgetsWithSpending('invalid')).rejects.toThrow();
    });

    it('rejects month out of range', async () => {
      await expect(getBudgetsWithSpending('2025-00')).rejects.toThrow('errors.invalidYearMonth');
      await expect(getBudgetsWithSpending('2025-13')).rejects.toThrow('errors.invalidYearMonth');
    });
  });

  describe('copyBudgetsFromMonth', () => {
    it('copies budgets from previous month to current month', async () => {
      await upsertBudget(categoryId1, '2025-01', 50000);
      await upsertBudget(categoryId2, '2025-01', 30000);

      const result = await copyBudgetsFromMonth('2025-01', '2025-02');

      expect(result).toEqual({
        copied: 2,
        skipped: 0,
        total: 2,
        monthlyBudgetCopied: false,
      });

      const febBudgets = await getBudgetsForMonth('2025-02');
      expect(febBudgets.find((b) => b.categoryId === categoryId1)?.budgetAmount).toBe(50000);
      expect(febBudgets.find((b) => b.categoryId === categoryId2)?.budgetAmount).toBe(30000);
    });

    it('skips categories that already have budgets in target month', async () => {
      await upsertBudget(categoryId1, '2025-01', 50000);
      await upsertBudget(categoryId2, '2025-01', 30000);
      await upsertBudget(categoryId1, '2025-02', 60000); // Already exists in target

      const result = await copyBudgetsFromMonth('2025-01', '2025-02');

      expect(result).toEqual({
        copied: 1,
        skipped: 1,
        total: 2,
        monthlyBudgetCopied: false,
      });

      // cat1 should keep original value, cat2 should be copied
      const febBudgets = await getBudgetsForMonth('2025-02');
      expect(febBudgets.find((b) => b.categoryId === categoryId1)?.budgetAmount).toBe(60000);
      expect(febBudgets.find((b) => b.categoryId === categoryId2)?.budgetAmount).toBe(30000);
    });

    it('copies monthlyBudget if exists in source and not in target', async () => {
      await upsertBudget(categoryId1, '2025-01', 50000);
      await upsertMonthlyBudget('2025-01', 100000);

      const result = await copyBudgetsFromMonth('2025-01', '2025-02');

      expect(result.monthlyBudgetCopied).toBe(true);
      expect(await getMonthlyBudget('2025-02')).toBe(100000);
    });

    it('does not copy monthlyBudget if target already has one', async () => {
      await upsertMonthlyBudget('2025-01', 100000);
      await upsertMonthlyBudget('2025-02', 150000);

      const result = await copyBudgetsFromMonth('2025-01', '2025-02');

      expect(result.monthlyBudgetCopied).toBe(false);
      expect(await getMonthlyBudget('2025-02')).toBe(150000);
    });

    it('returns zero stats when source has no budgets', async () => {
      const result = await copyBudgetsFromMonth('2025-01', '2025-02');

      expect(result).toEqual({
        copied: 0,
        skipped: 0,
        total: 0,
        monthlyBudgetCopied: false,
      });
    });

    it('handles source same as target (no budgets copied)', async () => {
      await upsertBudget(categoryId1, '2025-01', 50000);

      const result = await copyBudgetsFromMonth('2025-01', '2025-01');

      expect(result).toEqual({
        copied: 0,
        skipped: 1,
        total: 1,
        monthlyBudgetCopied: false,
      });
    });
  });

  describe('Budget Deletion via Cascade', () => {
    it('deletes budget when category is deleted (ON DELETE CASCADE)', async () => {
      await upsertBudget(categoryId1, '2025-01', 50000);

      // Delete category
      await db
        .delete(schema.categories)
        .where(eq(schema.categories.id, categoryId1));

      // Budget should be cascade deleted
      const budgets = await db
        .select()
        .from(schema.budgets)
        .where(eq(schema.budgets.categoryId, categoryId1));

      expect(budgets).toHaveLength(0);
    });

    it('budget with amount 0 is not deleted (budget still exists)', async () => {
      await upsertBudget(categoryId1, '2025-01', 0);

      const budgets = await db
        .select()
        .from(schema.budgets)
        .where(
          and(
            eq(schema.budgets.categoryId, categoryId1),
            eq(schema.budgets.yearMonth, '2025-01')
          )
        );

      expect(budgets).toHaveLength(1);
      expect(budgets[0].amount).toBe(0);
    });
  });
});
