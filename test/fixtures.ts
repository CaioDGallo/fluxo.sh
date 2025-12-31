import type { NewAccount, NewCategory, NewTransaction, NewEntry, NewIncome } from '@/lib/schema';

export const testAccounts = {
  creditCard: {
    name: 'Test Credit Card',
    type: 'credit_card' as const,
  },
  creditCardWithBilling: {
    name: 'Test CC with Billing',
    type: 'credit_card' as const,
    closingDay: 15,
    paymentDueDay: 5,
  },
  checking: {
    name: 'Test Checking',
    type: 'checking' as const,
  },
} satisfies Record<string, NewAccount>;

export const testCategories = {
  expense: {
    name: 'Test Expense Category',
    color: '#ef4444',
    icon: 'Restaurant01Icon',
    type: 'expense' as const,
  },
  income: {
    name: 'Test Salary',
    color: '#22c55e',
    icon: 'MoneyBag01Icon',
    type: 'income' as const,
  },
} satisfies Record<string, NewCategory>;

export function createTestTransaction(overrides: Partial<NewTransaction> = {}): NewTransaction {
  return {
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
    description: 'Test Income',
    amount: 50000, // R$ 500
    categoryId: 2,
    accountId: 1,
    receivedDate: new Date().toISOString().split('T')[0],
    receivedAt: null,
    ...overrides,
  };
}
