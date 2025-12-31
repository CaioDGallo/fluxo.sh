import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { testAccounts, testCategories } from '@/test/fixtures';

describe('Expense Actions - Happy Path', () => {
  let db: ReturnType<typeof getTestDb>;
  let accountId: number;
  let categoryId: number;

  // Dynamic imports after mocking
  let createExpense: any;
  let updateExpense: any;
  let deleteExpense: any;
  let getExpenses: any;
  let markEntryPaid: any;
  let markEntryPending: any;
  let updateTransactionCategory: any;

  beforeAll(async () => {
    db = await setupTestDb();

    // Mock the db module to use test database
    vi.doMock('@/lib/db', () => ({
      db,
    }));

    // Import actions after mocking
    const actions = await import('@/lib/actions/expenses');
    createExpense = actions.createExpense;
    updateExpense = actions.updateExpense;
    deleteExpense = actions.deleteExpense;
    getExpenses = actions.getExpenses;
    markEntryPaid = actions.markEntryPaid;
    markEntryPending = actions.markEntryPending;
    updateTransactionCategory = actions.updateTransactionCategory;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();

    // Seed test data
    const [account] = await db
      .insert(schema.accounts)
      .values(testAccounts.creditCard)
      .returning();

    const [category] = await db
      .insert(schema.categories)
      .values(testCategories.expense)
      .returning();

    accountId = account.id;
    categoryId = category.id;
  });

  describe('createExpense', () => {
    it('creates a single installment expense', async () => {
      await createExpense({
        description: 'Groceries',
        totalAmount: 10000, // R$ 100
        categoryId,
        accountId,
        dueDate: '2025-01-15',
        installments: 1,
      });

      const expenses = await getExpenses();

      expect(expenses).toHaveLength(1);
      expect(expenses[0]).toMatchObject({
        description: 'Groceries',
        amount: 10000,
        dueDate: '2025-01-15',
        installmentNumber: 1,
        totalInstallments: 1,
      });
      expect(expenses[0].paidAt).toBeNull();
    });

    it('creates multiple installment expense with correct amounts', async () => {
      await createExpense({
        description: 'Laptop',
        totalAmount: 300000, // R$ 3000
        categoryId,
        accountId,
        dueDate: '2025-01-15',
        installments: 3,
      });

      const expenses = await getExpenses();

      expect(expenses).toHaveLength(3);

      // Each installment should be R$ 1000 (100000 cents)
      expect(expenses[2].amount).toBe(100000);
      expect(expenses[1].amount).toBe(100000);
      expect(expenses[0].amount).toBe(100000);

      // Verify sum equals total
      const sum = expenses.reduce((acc, e) => acc + e.amount, 0);
      expect(sum).toBe(300000);
    });

    it('generates installments with incrementing months', async () => {
      await createExpense({
        description: 'Test',
        totalAmount: 30000,
        categoryId,
        accountId,
        dueDate: '2025-01-15',
        installments: 3,
      });

      const expenses = await getExpenses();

      // Ordered by dueDate desc, so newest first
      expect(expenses[2].dueDate).toBe('2025-01-15');
      expect(expenses[1].dueDate).toBe('2025-02-15');
      expect(expenses[0].dueDate).toBe('2025-03-15');
    });

    it('handles non-divisible amounts with rounding', async () => {
      // R$ 100 / 3 = 33.33... cents per installment
      await createExpense({
        description: 'Test',
        totalAmount: 10000,
        categoryId,
        accountId,
        dueDate: '2025-01-15',
        installments: 3,
      });

      const expenses = await getExpenses();

      // First two installments get 3333, last gets 3334 (absorbs remainder)
      expect(expenses[2].amount).toBe(3333);
      expect(expenses[1].amount).toBe(3333);
      expect(expenses[0].amount).toBe(3334);

      // Sum must equal total
      const sum = expenses.reduce((acc, e) => acc + e.amount, 0);
      expect(sum).toBe(10000);
    });
  });

  describe('getExpenses', () => {
    beforeEach(async () => {
      // Create test data for filtering
      await createExpense({
        description: 'January Expense',
        totalAmount: 10000,
        categoryId,
        accountId,
        dueDate: '2025-01-15',
        installments: 1,
      });

      await createExpense({
        description: 'February Expense',
        totalAmount: 20000,
        categoryId,
        accountId,
        dueDate: '2025-02-15',
        installments: 1,
      });
    });

    it('returns all expenses without filters', async () => {
      const expenses = await getExpenses();
      expect(expenses).toHaveLength(2);
    });

    it('filters by yearMonth', async () => {
      const janExpenses = await getExpenses({ yearMonth: '2025-01' });
      expect(janExpenses).toHaveLength(1);
      expect(janExpenses[0].description).toBe('January Expense');

      const febExpenses = await getExpenses({ yearMonth: '2025-02' });
      expect(febExpenses).toHaveLength(1);
      expect(febExpenses[0].description).toBe('February Expense');
    });

    it('filters by status: pending', async () => {
      const expenses = await getExpenses();
      await markEntryPaid(expenses[0].id);

      const pending = await getExpenses({ status: 'pending' });
      expect(pending).toHaveLength(1);
      expect(pending[0].paidAt).toBeNull();
    });

    it('filters by status: paid', async () => {
      const expenses = await getExpenses();
      await markEntryPaid(expenses[0].id);

      const paid = await getExpenses({ status: 'paid' });
      expect(paid).toHaveLength(1);
      expect(paid[0].paidAt).not.toBeNull();
    });

    it('filters by categoryId', async () => {
      const [newCategory] = await db
        .insert(schema.categories)
        .values({ name: 'Entertainment', color: '#3b82f6', type: 'expense' })
        .returning();

      await createExpense({
        description: 'Movie',
        totalAmount: 5000,
        categoryId: newCategory.id,
        accountId,
        dueDate: '2025-01-20',
        installments: 1,
      });

      const filtered = await getExpenses({ categoryId: newCategory.id });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].categoryId).toBe(newCategory.id);
      expect(filtered[0].categoryName).toBe('Entertainment');
    });

    it('filters by accountId', async () => {
      const [newAccount] = await db
        .insert(schema.accounts)
        .values({ name: 'Savings Account', type: 'savings' })
        .returning();

      await createExpense({
        description: 'Savings Expense',
        totalAmount: 5000,
        categoryId,
        accountId: newAccount.id,
        dueDate: '2025-01-20',
        installments: 1,
      });

      const filtered = await getExpenses({ accountId: newAccount.id });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].accountId).toBe(newAccount.id);
      expect(filtered[0].accountName).toBe('Savings Account');
    });
  });

  describe('updateExpense', () => {
    it('updates expense description and amount', async () => {
      await createExpense({
        description: 'Original',
        totalAmount: 10000,
        categoryId,
        accountId,
        dueDate: '2025-01-15',
        installments: 1,
      });

      const initial = await getExpenses();
      const transactionId = initial[0].transactionId;

      await updateExpense(transactionId, {
        description: 'Updated Description',
        totalAmount: 20000,
        categoryId,
        accountId,
        dueDate: '2025-01-15',
        installments: 1,
      });

      const updated = await getExpenses();
      expect(updated).toHaveLength(1);
      expect(updated[0].description).toBe('Updated Description');
      expect(updated[0].amount).toBe(20000);
    });

    it('updates installment count and regenerates entries', async () => {
      await createExpense({
        description: 'Test',
        totalAmount: 12000,
        categoryId,
        accountId,
        dueDate: '2025-01-15',
        installments: 2,
      });

      const initial = await getExpenses();
      expect(initial).toHaveLength(2);
      const transactionId = initial[0].transactionId;

      // Change from 2 to 4 installments
      await updateExpense(transactionId, {
        description: 'Test',
        totalAmount: 12000,
        categoryId,
        accountId,
        dueDate: '2025-01-15',
        installments: 4,
      });

      const updated = await getExpenses();
      expect(updated).toHaveLength(4);

      // Each should be R$ 30 (3000 cents)
      updated.forEach((entry) => {
        expect(entry.amount).toBe(3000);
      });
    });
  });

  describe('deleteExpense', () => {
    it('deletes transaction and all entries', async () => {
      await createExpense({
        description: 'To Delete',
        totalAmount: 30000,
        categoryId,
        accountId,
        dueDate: '2025-01-15',
        installments: 3,
      });

      const initial = await getExpenses();
      expect(initial).toHaveLength(3);

      await deleteExpense(initial[0].transactionId);

      const after = await getExpenses();
      expect(after).toHaveLength(0);
    });
  });

  describe('markEntryPaid / markEntryPending', () => {
    it('marks entry as paid', async () => {
      await createExpense({
        description: 'Test',
        totalAmount: 10000,
        categoryId,
        accountId,
        dueDate: '2025-01-15',
        installments: 1,
      });

      const expenses = await getExpenses();
      const entryId = expenses[0].id;

      await markEntryPaid(entryId);

      const updated = await getExpenses();
      expect(updated[0].paidAt).not.toBeNull();
    });

    it('marks entry as pending', async () => {
      await createExpense({
        description: 'Test',
        totalAmount: 10000,
        categoryId,
        accountId,
        dueDate: '2025-01-15',
        installments: 1,
      });

      const expenses = await getExpenses();
      await markEntryPaid(expenses[0].id);
      await markEntryPending(expenses[0].id);

      const updated = await getExpenses();
      expect(updated[0].paidAt).toBeNull();
    });

    it('only affects single entry, not all installments', async () => {
      await createExpense({
        description: 'Test',
        totalAmount: 30000,
        categoryId,
        accountId,
        dueDate: '2025-01-15',
        installments: 3,
      });

      const expenses = await getExpenses();
      await markEntryPaid(expenses[1].id); // Mark middle installment as paid

      const updated = await getExpenses();
      expect(updated[2].paidAt).toBeNull(); // First still pending
      expect(updated[1].paidAt).not.toBeNull(); // Middle is paid
      expect(updated[0].paidAt).toBeNull(); // Last still pending
    });
  });

  describe('updateTransactionCategory', () => {
    it('updates category for transaction', async () => {
      await createExpense({
        description: 'Test',
        totalAmount: 10000,
        categoryId,
        accountId,
        dueDate: '2025-01-15',
        installments: 1,
      });

      const [newCategory] = await db
        .insert(schema.categories)
        .values({ name: 'New Category', color: '#10b981', type: 'expense' })
        .returning();

      const initial = await getExpenses();
      await updateTransactionCategory(initial[0].transactionId, newCategory.id);

      const updated = await getExpenses();
      expect(updated[0].categoryId).toBe(newCategory.id);
      expect(updated[0].categoryName).toBe('New Category');
    });
  });
});
