// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BudgetForm } from '@/components/budget-form';
import { upsertBudget, upsertMonthlyBudget } from '@/lib/actions/budgets';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string>) => {
    const translations: Record<string, Record<string, (values?: Record<string, string>) => string>> = {
    budgets: {
      totalMonthlyBudget: () => 'Total Monthly Budget',
      leftFromBudget: (vals) => `Left ${vals?.remaining} of ${vals?.total}`,
      overBudget: (vals) => `Over ${vals?.over} of ${vals?.total}`,
      percentAllocated: (vals) => `${vals?.percent}% allocated`,
      saveChanges: () => 'Save changes',
      unsavedChanges: () => 'Unsaved changes',
      saved: () => 'All changes saved',
      searchPlaceholder: () => 'Search categories…',
      hideZeroBudgets: () => 'Hide zeros',
      noExpenseCategories: () => 'No expense categories',
      noExpenseCategoriesDescription: () => 'Create an expense category first',
      addExpenseCategory: () => 'Add expense category',
      noResults: () => 'No categories found',
    },
    common: {
      saving: () => 'Saving…',
    },
    errors: {
      failedToSave: () => 'Failed to save',
    },
    };

    return translations[namespace]?.[key]?.(values) ?? key;
  },
}));

vi.mock('@/lib/actions/budgets', () => ({
  upsertBudget: vi.fn(),
  upsertMonthlyBudget: vi.fn(),
}));

const baseBudgets = [
  {
    categoryId: 1,
    categoryName: 'Food',
    categoryColor: '#ef4444',
    categoryIcon: 'Restaurant01Icon',
    budgetAmount: null,
  },
  {
    categoryId: 2,
    categoryName: 'Bills',
    categoryColor: '#3b82f6',
    categoryIcon: 'Invoice01Icon',
    budgetAmount: null,
  },
];

// Helper to type in CurrencyInput and properly clear before typing new value
async function typeCurrencyInput(user: ReturnType<typeof userEvent.setup>, input: HTMLElement, value: string) {
  await input.focus();
  await user.keyboard('{Control>}a{/Control}');
  for (let i = 0; i < 10; i++) {
    await user.keyboard('{Backspace}');
  }
  await user.type(input, value);
}

describe('BudgetForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles monthly budget save with error and success states', async () => {
    const user = userEvent.setup();
    vi.mocked(upsertMonthlyBudget)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);

    render(
      <BudgetForm
        yearMonth="2026-01"
        budgets={baseBudgets}
        monthlyBudget={null}
      />
    );

    const totalInput = screen.getByLabelText('Total Monthly Budget');
    const saveButton = screen.getByRole('button', { name: 'Save changes' });

    await typeCurrencyInput(user, totalInput, '100.00');
    await user.click(saveButton);

    expect(await screen.findByText('Failed to save')).toBeInTheDocument();

    await typeCurrencyInput(user, totalInput, '200.00');
    await user.click(saveButton);

    await waitFor(() => {
      expect(upsertMonthlyBudget).toHaveBeenCalledWith('2026-01', 20000);
      expect(screen.queryByText('Failed to save')).not.toBeInTheDocument();
    });
  });

  it('handles category budget save with error and success states', async () => {
    const user = userEvent.setup();
    vi.mocked(upsertBudget)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);

    render(
      <BudgetForm
        yearMonth="2026-01"
        budgets={baseBudgets}
        monthlyBudget={null}
      />
    );

    const foodInput = screen.getByLabelText('Food');
    const saveButton = screen.getByRole('button', { name: 'Save changes' });

    await typeCurrencyInput(user, foodInput, '50.00');
    await user.click(saveButton);

    expect(await screen.findByText('Failed to save')).toBeInTheDocument();

    await typeCurrencyInput(user, foodInput, '75.00');
    await user.click(saveButton);

    await waitFor(() => {
      expect(upsertBudget).toHaveBeenCalledWith(1, '2026-01', 7500);
      expect(screen.queryByText('Failed to save')).not.toBeInTheDocument();
    });
  });

  it('reflects remaining or over-budget allocations in text and progress bar', () => {
    const { container } = render(
      <BudgetForm
        yearMonth="2026-01"
        budgets={[
          { ...baseBudgets[0], budgetAmount: 6000 },
          { ...baseBudgets[1], budgetAmount: 5000 },
        ]}
        monthlyBudget={10000}
      />
    );

    expect(screen.getByText('Over 10.00 of 100.00')).toBeInTheDocument();
    expect(screen.getByText('110.0% allocated')).toBeInTheDocument();

    const progressBar = container.querySelector('[role="progressbar"] > div') as HTMLElement;
    expect(progressBar).toHaveStyle({ width: '100%' });
  });
});
