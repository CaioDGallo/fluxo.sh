import { test as base } from '@playwright/test';
import { resetDatabase } from '@/lib/test-utils';
import { db } from '@/lib/db';
import type {
  NewAccount,
  NewCategory,
  NewTransaction,
  NewEntry,
  NewIncome,
  NewFatura,
  NewMonthlyBudget,
  NewBillReminder,
} from '@/lib/schema';

export { expect } from '@playwright/test';

export const TEST_USER_ID = 'test-user-fixtures-id';

export const testAccounts = {
  creditCard: {
    userId: TEST_USER_ID,
    name: 'Test Credit Card',
    type: 'credit_card' as const,
  },
  creditCardWithBilling: {
    userId: TEST_USER_ID,
    name: 'Test CC with Billing',
    type: 'credit_card' as const,
    closingDay: 15,
    paymentDueDay: 5,
  },
  checking: {
    userId: TEST_USER_ID,
    name: 'Test Checking',
    type: 'checking' as const,
  },
} satisfies Record<string, NewAccount>;

export const testCategories = {
  expense: {
    userId: TEST_USER_ID,
    name: 'Test Expense Category',
    color: '#ef4444',
    icon: 'Restaurant01Icon',
    type: 'expense' as const,
  },
  income: {
    userId: TEST_USER_ID,
    name: 'Test Salary',
    color: '#22c55e',
    icon: 'MoneyBag01Icon',
    type: 'income' as const,
  },
} satisfies Record<string, NewCategory>;

export function createTestTransaction(overrides: Partial<NewTransaction> = {}): NewTransaction {
  return {
    userId: TEST_USER_ID,
    description: 'Test Transaction',
    totalAmount: 10000, // R$ 100
    totalInstallments: 1,
    categoryId: 1,
    ...overrides,
  };
}

export function createTestEntry(overrides: Partial<NewEntry> = {}): NewEntry {
  const date = new Date().toISOString().split('T')[0];
  return {
    userId: TEST_USER_ID,
    transactionId: 1,
    accountId: 1,
    amount: 10000,
    purchaseDate: date,
    faturaMonth: date.slice(0, 7),
    dueDate: date,
    installmentNumber: 1,
    paidAt: null,
    ...overrides,
  };
}

export function createTestIncome(overrides: Partial<NewIncome> = {}): NewIncome {
  return {
    userId: TEST_USER_ID,
    description: 'Test Income',
    amount: 50000, // R$ 500
    categoryId: 2,
    accountId: 1,
    receivedDate: new Date().toISOString().split('T')[0],
    receivedAt: null,
    ...overrides,
  };
}

export function createTestFatura(overrides: Partial<NewFatura> = {}): NewFatura {
  const dueDate = new Date().toISOString().split('T')[0];
  const yearMonth = dueDate.slice(0, 7);
  const closingDate = `${yearMonth}-15`;
  return {
    userId: TEST_USER_ID,
    accountId: 1,
    yearMonth,
    closingDate,
    totalAmount: 20000, // R$ 200
    dueDate,
    ...overrides,
  };
}

export function createTestMonthlyBudget(overrides: Partial<NewMonthlyBudget> = {}): NewMonthlyBudget {
  const yearMonth = new Date().toISOString().slice(0, 7);
  return {
    userId: TEST_USER_ID,
    yearMonth,
    amount: 50000, // R$ 500
    ...overrides,
  };
}

export function createTestBillReminder(overrides: Partial<NewBillReminder> = {}): NewBillReminder {
  const startMonth = new Date().toISOString().slice(0, 7);
  return {
    userId: TEST_USER_ID,
    name: 'Test Bill Reminder',
    dueDay: 15,
    startMonth,
    recurrenceType: 'monthly',
    status: 'active',
    notify2DaysBefore: true,
    notify1DayBefore: true,
    notifyOnDueDay: true,
    ...overrides,
  };
}


// Extend the test object
export const test = base.extend<{ db: typeof db; resetDb: void }>({
  resetDb: [
    async ({}, run) => {
      await resetDatabase();
      await run(undefined);
    },
    { auto: true },
  ],
  db: async ({}, run) => {
    await run(db);
  },
});
