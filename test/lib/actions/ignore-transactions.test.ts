import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID, testAccounts, testCategories } from '@/test/fixtures';
import { eq } from 'drizzle-orm';

const OTHER_USER_ID = 'other-user-id';

type ExpenseActions = typeof import('@/lib/actions/expenses');
type IncomeActions = typeof import('@/lib/actions/income');
type DashboardActions = typeof import('@/lib/actions/dashboard');
type BudgetActions = typeof import('@/lib/actions/budgets');
type AccountActions = typeof import('@/lib/actions/accounts');

type DbClient = ReturnType<typeof getTestDb>;

describe('Ignore Transactions', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let db: DbClient;

  let toggleIgnoreTransaction: ExpenseActions['toggleIgnoreTransaction'];
  let toggleIgnoreIncome: IncomeActions['toggleIgnoreIncome'];
  let getDashboardData: DashboardActions['getDashboardData'];
  let getBudgetsWithSpending: BudgetActions['getBudgetsWithSpending'];
  let syncAccountBalance: AccountActions['syncAccountBalance'];

  let getCurrentUserIdMock: ReturnType<typeof vi.fn>;

  const seedAccount = async (values: typeof schema.accounts.$inferInsert) => {
    const [account] = await db.insert(schema.accounts).values(values).returning();
    return account;
  };

  const seedOtherAccount = async (values: typeof schema.accounts.$inferInsert) => {
    const [account] = await db.insert(schema.accounts).values({ ...values, userId: OTHER_USER_ID }).returning();
    return account;
  };

  const seedCategory = async (type: 'expense' | 'income' = 'expense') => {
    const categoryData = type === 'expense' ? testCategories.expense : testCategories.income;
    const [category] = await db.insert(schema.categories).values(categoryData).returning();
    return category;
  };

  const seedBudget = async (categoryId: number, yearMonth: string, amount: number) => {
    await db.insert(schema.budgets).values({
      userId: TEST_USER_ID,
      categoryId,
      yearMonth,
      amount,
    });
  };

  const seedTransaction = async (
    accountId: number,
    categoryId: number,
    amount: number,
    purchaseDate: string
  ) => {
    const [transaction] = await db
      .insert(schema.transactions)
      .values({
        userId: TEST_USER_ID,
        description: 'Test Transaction',
        totalAmount: amount,
        totalInstallments: 1,
        categoryId,
      })
      .returning();

    const [entry] = await db
      .insert(schema.entries)
      .values({
        userId: TEST_USER_ID,
        transactionId: transaction.id,
        accountId,
        amount,
        purchaseDate,
        faturaMonth: purchaseDate.slice(0, 7),
        dueDate: purchaseDate,
        installmentNumber: 1,
        paidAt: null,
      })
      .returning();

    await syncAccountBalance(accountId);

    return { transaction, entry };
  };

  const seedIncome = async (accountId: number, categoryId: number, amount: number, date: string) => {
    const [incomeRecord] = await db
      .insert(schema.income)
      .values({
        userId: TEST_USER_ID,
        description: 'Test Income',
        amount,
        categoryId,
        accountId,
        receivedDate: date,
        receivedAt: new Date(date),
      })
      .returning();

    await syncAccountBalance(accountId);

    return incomeRecord;
  };

  const loadActions = async () => {
    const expenseActions = await import('@/lib/actions/expenses');
    toggleIgnoreTransaction = expenseActions.toggleIgnoreTransaction;

    const incomeActions = await import('@/lib/actions/income');
    toggleIgnoreIncome = incomeActions.toggleIgnoreIncome;

    const dashboardActions = await import('@/lib/actions/dashboard');
    getDashboardData = dashboardActions.getDashboardData;

    const budgetActions = await import('@/lib/actions/budgets');
    getBudgetsWithSpending = budgetActions.getBudgetsWithSpending;

    const accountActions = await import('@/lib/actions/accounts');
    syncAccountBalance = accountActions.syncAccountBalance;
  };

  beforeAll(async () => {
    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({
      db,
    }));

    getCurrentUserIdMock = vi.fn().mockResolvedValue(TEST_USER_ID);
    vi.doMock('@/lib/auth', () => ({
      getCurrentUserId: getCurrentUserIdMock,
    }));

    await loadActions();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.resetModules();
    vi.doMock('@/lib/db', () => ({
      db,
    }));
    getCurrentUserIdMock = vi.fn().mockResolvedValue(TEST_USER_ID);
    vi.doMock('@/lib/auth', () => ({
      getCurrentUserId: getCurrentUserIdMock,
    }));
    await loadActions();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Toggle Operations', () => {
    it('rejects not authenticated for expenses', async () => {
      getCurrentUserIdMock.mockResolvedValueOnce('');
      await expect(toggleIgnoreTransaction(1)).rejects.toThrow();
    });

    it('rejects not authenticated for income', async () => {
      getCurrentUserIdMock.mockResolvedValueOnce('');
      await expect(toggleIgnoreIncome(1)).rejects.toThrow();
    });

    it('rejects invalid expense id', async () => {
      await expect(toggleIgnoreTransaction(0)).rejects.toThrow();
    });

    it('rejects invalid income id', async () => {
      await expect(toggleIgnoreIncome(-1)).rejects.toThrow();
    });

    it('rejects missing expense records', async () => {
      await expect(toggleIgnoreTransaction(999999)).rejects.toThrow();
    });

    it('rejects missing income records', async () => {
      await expect(toggleIgnoreIncome(999999)).rejects.toThrow();
    });

    it('blocks toggling transactions from other users', async () => {
      const category = await seedCategory('expense');
      const otherAccount = await seedOtherAccount({ ...testAccounts.checking, name: 'Other Account' });

      const [otherTransaction] = await db
        .insert(schema.transactions)
        .values({
          userId: OTHER_USER_ID,
          description: 'Other Txn',
          totalAmount: 12000,
          totalInstallments: 1,
          categoryId: category.id,
        })
        .returning();

      await db.insert(schema.entries).values({
        userId: OTHER_USER_ID,
        transactionId: otherTransaction.id,
        accountId: otherAccount.id,
        amount: 12000,
        purchaseDate: '2025-01-12',
        faturaMonth: '2025-01',
        dueDate: '2025-01-12',
        installmentNumber: 1,
        paidAt: null,
      });

      await expect(toggleIgnoreTransaction(otherTransaction.id)).rejects.toThrow();

      const [record] = await db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.id, otherTransaction.id));
      expect(record.ignored).toBe(false);
    });

    it('blocks toggling income from other users', async () => {
      const otherAccount = await seedOtherAccount({ ...testAccounts.checking, name: 'Other Income Account' });
      const category = await seedCategory('income');

      const [otherIncome] = await db
        .insert(schema.income)
        .values({
          userId: OTHER_USER_ID,
          description: 'Other Income',
          amount: 22000,
          categoryId: category.id,
          accountId: otherAccount.id,
          receivedDate: '2025-01-15',
          receivedAt: new Date('2025-01-15'),
        })
        .returning();

      await expect(toggleIgnoreIncome(otherIncome.id)).rejects.toThrow();

      const [record] = await db
        .select()
        .from(schema.income)
        .where(eq(schema.income.id, otherIncome.id));
      expect(record.ignored).toBe(false);

      const dashboard = await getDashboardData('2025-01');
      expect(dashboard.totalIncome).toBe(0);
    });

    it('toggleIgnoreTransaction flips ignored state for expenses', async () => {
      const account = await seedAccount(testAccounts.checking);
      const category = await seedCategory('expense');
      const { transaction } = await seedTransaction(account.id, category.id, 10000, '2025-01-15');

      // Initially not ignored
      let [record] = await db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.id, transaction.id));
      expect(record.ignored).toBe(false);

      // Toggle to ignored
      await toggleIgnoreTransaction(transaction.id);

      [record] = await db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.id, transaction.id));
      expect(record.ignored).toBe(true);

      // Toggle back to not ignored
      await toggleIgnoreTransaction(transaction.id);

      [record] = await db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.id, transaction.id));
      expect(record.ignored).toBe(false);
    });

    it('toggleIgnoreIncome flips ignored state for income', async () => {
      const account = await seedAccount(testAccounts.checking);
      const category = await seedCategory('income');
      const incomeRecord = await seedIncome(account.id, category.id, 50000, '2025-01-15');

      // Initially not ignored
      let [record] = await db
        .select()
        .from(schema.income)
        .where(eq(schema.income.id, incomeRecord.id));
      expect(record.ignored).toBe(false);

      // Toggle to ignored
      await toggleIgnoreIncome(incomeRecord.id);

      [record] = await db
        .select()
        .from(schema.income)
        .where(eq(schema.income.id, incomeRecord.id));
      expect(record.ignored).toBe(true);

      // Toggle back
      await toggleIgnoreIncome(incomeRecord.id);

      [record] = await db
        .select()
        .from(schema.income)
        .where(eq(schema.income.id, incomeRecord.id));
      expect(record.ignored).toBe(false);
    });
  });

  describe('Dashboard Excludes Ignored', () => {
    it('ignored expenses excluded from spending totals', async () => {
      const account = await seedAccount(testAccounts.checking);
      const category = await seedCategory('expense');
      await seedBudget(category.id, '2025-01', 50000);

      await seedTransaction(account.id, category.id, 10000, '2025-01-10');
      const { transaction: tx2 } = await seedTransaction(account.id, category.id, 15000, '2025-01-15');
      const { transaction: tx3 } = await seedTransaction(account.id, category.id, 20000, '2025-01-20');

      // Before ignoring - total should be 45000
      let dashboard = await getDashboardData('2025-01');
      expect(dashboard.totalSpent).toBe(45000);
      expect(dashboard.categoryBreakdown[0].spent).toBe(45000);

      // Ignore one transaction
      await toggleIgnoreTransaction(tx2.id);

      // After ignoring - should be 30000 (10000 + 20000)
      dashboard = await getDashboardData('2025-01');
      expect(dashboard.totalSpent).toBe(30000);
      expect(dashboard.categoryBreakdown[0].spent).toBe(30000);

      // Ignore another
      await toggleIgnoreTransaction(tx3.id);

      // Should be 10000
      dashboard = await getDashboardData('2025-01');
      expect(dashboard.totalSpent).toBe(10000);
      expect(dashboard.categoryBreakdown[0].spent).toBe(10000);
    });

    it('ignored income excluded from income totals', async () => {
      const account = await seedAccount(testAccounts.checking);
      const category = await seedCategory('income');

      await seedIncome(account.id, category.id, 50000, '2025-01-01');
      const income2 = await seedIncome(account.id, category.id, 30000, '2025-01-15');
      const income3 = await seedIncome(account.id, category.id, 20000, '2025-01-25');

      // Before ignoring
      let dashboard = await getDashboardData('2025-01');
      expect(dashboard.totalIncome).toBe(100000);

      // Ignore one
      await toggleIgnoreIncome(income2.id);

      dashboard = await getDashboardData('2025-01');
      expect(dashboard.totalIncome).toBe(70000);

      // Ignore another
      await toggleIgnoreIncome(income3.id);

      dashboard = await getDashboardData('2025-01');
      expect(dashboard.totalIncome).toBe(50000);
    });
  });

  describe('Budget Excludes Ignored', () => {
    it('getBudgetsWithSpending excludes ignored transactions', async () => {
      const account = await seedAccount(testAccounts.checking);
      const category = await seedCategory('expense');
      await seedBudget(category.id, '2025-01', 50000);

      const { transaction: tx1 } = await seedTransaction(account.id, category.id, 10000, '2025-01-10');
      const { transaction: tx2 } = await seedTransaction(account.id, category.id, 15000, '2025-01-15');
      const { transaction: tx3 } = await seedTransaction(account.id, category.id, 20000, '2025-01-20');

      // Before ignoring
      let budgets = await getBudgetsWithSpending('2025-01');
      expect(budgets.budgets[0].spent).toBe(45000);
      expect(budgets.budgets[0].budget).toBe(50000);

      // Ignore one transaction
      await toggleIgnoreTransaction(tx2.id);

      budgets = await getBudgetsWithSpending('2025-01');
      expect(budgets.budgets[0].spent).toBe(30000);

      // Ignore all transactions
      await toggleIgnoreTransaction(tx1.id);
      await toggleIgnoreTransaction(tx3.id);

      budgets = await getBudgetsWithSpending('2025-01');
      expect(budgets.budgets[0].spent).toBe(0);
      expect(budgets.budgets[0].budget).toBe(50000);
    });

    it('budget progress accurate after ignoring', async () => {
      const account = await seedAccount(testAccounts.checking);
      const category = await seedCategory('expense');
      await seedBudget(category.id, '2025-01', 100000); // R$ 1000 budget

      // Spend R$ 750 (75% of budget)
      const { transaction: tx1 } = await seedTransaction(account.id, category.id, 50000, '2025-01-10');
      await seedTransaction(account.id, category.id, 25000, '2025-01-15');

      let budgets = await getBudgetsWithSpending('2025-01');
      expect(budgets.budgets[0].spent).toBe(75000);
      expect(budgets.budgets[0].budget).toBe(100000);

      // Ignore largest expense - should drop to 25% of budget
      await toggleIgnoreTransaction(tx1.id);

      budgets = await getBudgetsWithSpending('2025-01');
      expect(budgets.budgets[0].spent).toBe(25000);

      // Un-ignore and verify back to 75000
      await toggleIgnoreTransaction(tx1.id);

      budgets = await getBudgetsWithSpending('2025-01');
      expect(budgets.budgets[0].spent).toBe(75000);
    });
  });

  describe('Account Balance Sync', () => {
    it('balance recalculated correctly after toggling ignore on expense', async () => {
      const account = await seedAccount({ ...testAccounts.creditCard, currentBalance: 0 });
      const category = await seedCategory('expense');

      // Add expense - balance should become negative
      const { transaction } = await seedTransaction(account.id, category.id, 10000, '2025-01-15');

      let [accountRecord] = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, account.id));
      expect(accountRecord.currentBalance).toBe(-10000);

      // Ignore expense - balance should remain unchanged
      await toggleIgnoreTransaction(transaction.id);

      [accountRecord] = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, account.id));
      expect(accountRecord.currentBalance).toBe(-10000);

      // Un-ignore - balance should stay -10000
      await toggleIgnoreTransaction(transaction.id);

      [accountRecord] = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, account.id));
      expect(accountRecord.currentBalance).toBe(-10000);
    });

    it('balance recalculated correctly after toggling ignore on income', async () => {
      const account = await seedAccount({ ...testAccounts.checking, currentBalance: 0 });
      const category = await seedCategory('income');

      const incomeRecord = await seedIncome(account.id, category.id, 50000, '2025-01-15');

      // Balance should be 50000
      let [accountRecord] = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, account.id));
      expect(accountRecord.currentBalance).toBe(50000);

      // Ignore income - balance should remain unchanged
      await toggleIgnoreIncome(incomeRecord.id);

      [accountRecord] = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, account.id));
      expect(accountRecord.currentBalance).toBe(50000);

      // Un-ignore
      await toggleIgnoreIncome(incomeRecord.id);

      [accountRecord] = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, account.id));
      expect(accountRecord.currentBalance).toBe(50000);
    });
  });

  describe('Multi-Account Installment Impact', () => {
    it('ignoring transaction with entries across accounts syncs all balances', async () => {
      const account1 = await seedAccount({
        ...testAccounts.creditCard,
        name: 'CC 1',
        currentBalance: 0,
      });
      const account2 = await seedAccount({
        ...testAccounts.creditCard,
        name: 'CC 2',
        currentBalance: 0,
      });
      const category = await seedCategory('expense');

      // Create transaction with 2 installments
      const [transaction] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Multi-account purchase',
          totalAmount: 40000,
          totalInstallments: 2,
          categoryId: category.id,
        })
        .returning();

      // Entry 1 on account1
      await db.insert(schema.entries).values({
        userId: TEST_USER_ID,
        transactionId: transaction.id,
        accountId: account1.id,
        amount: 20000,
        purchaseDate: '2025-01-10',
        faturaMonth: '2025-01',
        dueDate: '2025-02-05',
        installmentNumber: 1,
        paidAt: null,
      });
      await syncAccountBalance(account1.id);

      // Entry 2 on account2
      await db.insert(schema.entries).values({
        userId: TEST_USER_ID,
        transactionId: transaction.id,
        accountId: account2.id,
        amount: 20000,
        purchaseDate: '2025-02-10',
        faturaMonth: '2025-02',
        dueDate: '2025-03-05',
        installmentNumber: 2,
        paidAt: null,
      });
      await syncAccountBalance(account2.id);

      // Both accounts should have negative balance
      let [acc1] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, account1.id));
      let [acc2] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, account2.id));
      expect(acc1.currentBalance).toBe(-20000);
      expect(acc2.currentBalance).toBe(-20000);

      // Ignore transaction - balances should remain unchanged
      await toggleIgnoreTransaction(transaction.id);

      [acc1] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, account1.id));
      [acc2] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, account2.id));
      expect(acc1.currentBalance).toBe(-20000);
      expect(acc2.currentBalance).toBe(-20000);

      // Un-ignore - balances should stay -20000
      await toggleIgnoreTransaction(transaction.id);

      [acc1] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, account1.id));
      [acc2] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, account2.id));
      expect(acc1.currentBalance).toBe(-20000);
      expect(acc2.currentBalance).toBe(-20000);
    });
  });
});
