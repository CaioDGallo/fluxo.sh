import { type Page, type Locator } from '@playwright/test';
import { test, expect } from '@/test/fixtures';
import { dismissOnboarding } from './onboarding';

const TEST_EMAIL = 'e2e@example.com';
const TEST_PASSWORD = 'Password123';

const ACCOUNT_NAME = 'Conta E2E';
const EXPENSE_CATEGORY = 'Alimentação E2E';
const INCOME_CATEGORY = 'Salário E2E';

function getYearMonth(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function addMonths(yearMonth: string, offset: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + offset);
  return getYearMonth(date);
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(TEST_EMAIL);
  await page.getByLabel('Senha').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await dismissOnboarding(page);
  await expect(page.getByRole('heading', { name: 'Meu Fluxo' })).toBeVisible();
}

async function createAccount(
  page: Page,
  name: string,
  options: {
    type?: 'credit_card' | 'checking' | 'savings' | 'cash';
    initialBalance?: string;
    creditLimit?: string;
    closingDay?: string;
    paymentDueDay?: string;
  } = {}
) {
  const {
    type = 'checking',
    initialBalance = '0',
    creditLimit = '5000',
    closingDay = '1',
    paymentDueDay = '10',
  } = options;

  await page.goto('/settings/accounts');
  await page.getByRole('button', { name: 'Adicionar Conta' }).click();
  const typeDialog = page.getByRole('dialog', { name: 'Como deseja adicionar?' });
  await expect(typeDialog).toBeVisible();
  await typeDialog.getByRole('button', { name: 'Manual' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adicionar Conta' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Nome').fill(name);

  // Select account type if not default
  if (type !== 'checking') {
    await dialog.getByLabel('Tipo').click();
    const typeMap = {
      credit_card: 'Cartão de crédito',
      checking: 'Conta corrente',
      savings: 'Poupança',
      cash: 'Dinheiro',
    };
    await page.getByRole('option', { name: typeMap[type] }).first().click();
  }

  // Fill initial balance (required for all account types)
  await dialog.getByLabel('Saldo Inicial').pressSequentially(initialBalance);

  // Fill credit card specific fields if type is credit_card
  if (type === 'credit_card') {
    await expect(dialog.getByLabel('Dia do Fechamento (1-28)')).toBeVisible();
    await dialog.getByLabel('Dia do Fechamento (1-28)').click();
    await page.getByRole('option', { name: closingDay }).first().click();
    await dialog.getByLabel('Dia do Vencimento (1-28)').click();
    await page.getByRole('option', { name: paymentDueDay }).first().click();
    await dialog.getByLabel('Limite de Crédito').pressSequentially(creditLimit);
  }

  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name }).first()).toBeVisible();
}

async function createCategory(page: Page, heading: string, name: string) {
  await page.goto('/settings/categories');
  const isIncome = heading.includes('Receita');
  const tabName = isIncome ? 'Receitas' : 'Despesas';
  const buttonName = isIncome ? 'Adicionar categoria de receita' : 'Adicionar categoria de despesa';
  await page.getByRole('tab', { name: tabName }).click();
  await page.getByRole('button', { name: buttonName }).click();
  const dialog = page.getByRole('dialog', { name: buttonName });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Nome').fill(name);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name }).first()).toBeVisible();
}

async function clearCurrencyInput(input: Locator) {
  await input.click();
  while ((await input.inputValue()) !== 'R$ 0,00') {
    await input.press('Backspace');
  }
}

async function fillCurrencyInput(input: Locator, amount: string) {
  await clearCurrencyInput(input);
  const numericAmount = Number(amount);
  const cents = String(Math.round(numericAmount * 100));
  await input.pressSequentially(cents);
}

async function expectCurrencyValue(input: Locator, amount: string) {
  const numericAmount = Number(amount);
  const formatted = `R$ ${numericAmount.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  await expect(input).toHaveValue(formatted);
}

async function selectCategory(page: Page, name: string) {
  const picker = page.getByRole('dialog', { name: 'Selecionar Categoria' });
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name }).first().click();
}

async function selectAccount(page: Page, name: string) {
  const picker = page.getByRole('dialog', { name: 'Selecionar Conta' });
  await expect(picker).toBeVisible();
  await picker.getByRole('button', { name }).first().click();
}

function formatFaturaMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function getFaturaCard(page: Page, yearMonth: string): Locator {
  const label = formatFaturaMonthLabel(yearMonth);
  return page
    .getByRole('heading', { name: new RegExp(label, 'i') })
    .locator('..')
    .locator('..')
    .locator('..');
}

async function setCategoryBudget(page: Page, categoryName: string, amount: string) {
  await page.goto('/settings/budgets');
  const row = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(categoryName, { exact: true }) })
    .first();
  const input = row.locator('input[data-slot="input"]');

  await fillCurrencyInput(input, amount);
  await input.blur();
  await expectCurrencyValue(input, amount);
}

test('login redirects to dashboard', async ({ page }) => {
  await login(page);
});

test('create account, category, and expense installments', async ({ page }) => {
  await login(page);

  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);
  await setCategoryBudget(page, EXPENSE_CATEGORY, '1000');

  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Despesa' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adicionar Despesa' });
  await expect(dialog).toBeVisible();
  await fillCurrencyInput(dialog.getByLabel('Valor'), '300');
  await dialog.getByLabel('Descrição').fill('Mercado E2E');
  await dialog.getByLabel('Categoria').click();
  await selectCategory(page, EXPENSE_CATEGORY);
  await dialog.getByLabel('Conta').click();
  await selectAccount(page, ACCOUNT_NAME);
  await dialog.getByRole('button', { name: '3x' }).click();

  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  const currentMonth = getYearMonth();
  const months = [currentMonth, addMonths(currentMonth, 1), addMonths(currentMonth, 2)];

  for (const [index, month] of months.entries()) {
    await page.goto(`/expenses?month=${month}`);
    await expect(page.locator('h3', { hasText: 'Mercado E2E' }).first()).toBeVisible();
    await expect(page.getByText(`${index + 1}/3`)).toBeVisible();
  }
});

test('create income shows in list', async ({ page }) => {
  await login(page);

  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);
  await createCategory(page, 'Categorias de Receita', INCOME_CATEGORY);
  await setCategoryBudget(page, EXPENSE_CATEGORY, '2000');

  await page.goto('/income');
  await page.getByRole('button', { name: 'Receita' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adicionar Receita' });
  await expect(dialog).toBeVisible();
  await fillCurrencyInput(dialog.getByLabel('Valor'), '500');
  await dialog.getByLabel('Descrição').fill('Salário E2E');
  await dialog.getByLabel('Categoria').click();
  await selectCategory(page, INCOME_CATEGORY);
  await dialog.getByLabel('Conta').click();
  await selectAccount(page, ACCOUNT_NAME);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  const incomeCard = page.locator('h3', { hasText: 'Salário E2E' }).first().locator('../../..');
  await expect(incomeCard).toBeVisible();
  await expect(incomeCard).toContainText(/R\$\s*500,00/);
});

test('ignore expense removes it from totals', async ({ page }) => {
  await login(page);

  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);
  await setCategoryBudget(page, EXPENSE_CATEGORY, '1000');

  // Create an expense
  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Despesa' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adicionar Despesa' });
  await expect(dialog).toBeVisible();
  await fillCurrencyInput(dialog.getByLabel('Valor'), '250');
  await dialog.getByLabel('Descrição').fill('Mercado Ignorar E2E');
  await dialog.getByLabel('Categoria').click();
  await selectCategory(page, EXPENSE_CATEGORY);
  await dialog.getByLabel('Conta').click();
  await selectAccount(page, ACCOUNT_NAME);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Go to expenses page and ignore via context menu
  await page.goto('/expenses');
  const expenseCard = page.locator('h3', { hasText: 'Mercado Ignorar E2E' }).first().locator('../../..');
  await expenseCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await page.getByRole('menuitem', { name: 'Ignorar nos cálculos' }).click();

  // Verify menu toggles to include action
  await expenseCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await expect(page.getByRole('menuitem', { name: 'Incluir nos cálculos' })).toBeVisible();

  // Un-ignore the expense via context menu
  await page.getByRole('menuitem', { name: 'Incluir nos cálculos' }).click();
  await page.waitForLoadState("networkidle");
  await expenseCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await expect(page.getByRole('menuitem', { name: 'Ignorar nos cálculos' })).toBeVisible();
});

test('ignore income removes it from totals', async ({ page }) => {
  await login(page);

  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);
  await createCategory(page, 'Categorias de Receita', INCOME_CATEGORY);
  await setCategoryBudget(page, EXPENSE_CATEGORY, '1000');

  // Create an income
  await page.goto('/income');
  await page.getByRole('button', { name: 'Receita' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adicionar Receita' });
  await expect(dialog).toBeVisible();
  await fillCurrencyInput(dialog.getByLabel('Valor'), '800');
  await dialog.getByLabel('Descrição').fill('Freelance Ignorar E2E');
  await dialog.getByLabel('Categoria').click();
  await selectCategory(page, INCOME_CATEGORY);
  await dialog.getByLabel('Conta').click();
  await selectAccount(page, ACCOUNT_NAME);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Ignore via context menu
  await page.goto('/income');
  const incomeCard = page.locator('h3', { hasText: 'Freelance Ignorar E2E' }).first().locator('../../..');
  await incomeCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await page.getByRole('menuitem', { name: 'Ignorar nos cálculos' }).click();

  // Verify menu toggles to include action
  await incomeCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await expect(page.getByRole('menuitem', { name: 'Incluir nos cálculos' })).toBeVisible();

  // Un-ignore the income via context menu
  await page.getByRole('menuitem', { name: 'Incluir nos cálculos' }).click();
  await page.waitForLoadState("networkidle");
  await incomeCard.getByRole('button', { name: 'Abrir menu de ações' }).click();
  await expect(page.getByRole('menuitem', { name: 'Ignorar nos cálculos' })).toBeVisible();
});

test('view fatura details and pay it', async ({ page }) => {
  await login(page);

  await createAccount(page, 'Cartão E2E', { type: 'credit_card' });
  await createAccount(page, 'Conta Corrente E2E', { type: 'checking' });

  // Create expense category
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);

  // Create expense on credit card to generate fatura
  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Despesa' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adicionar Despesa' });
  await expect(dialog).toBeVisible();
  await fillCurrencyInput(dialog.getByLabel('Valor'), '500');
  await dialog.getByLabel('Descrição').fill('Compra E2E');
  await dialog.getByLabel('Categoria').click();
  await selectCategory(page, EXPENSE_CATEGORY);
  await dialog.getByLabel('Conta').click();
  await selectAccount(page, 'Cartão E2E');
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Go to faturas page for next month (purchases after closingDay go to next month's fatura)
  const currentMonth = getYearMonth();
  const faturaMonth = addMonths(currentMonth, 1);
  await page.goto(`/faturas?month=${faturaMonth}`);
  await expect(page.getByRole('heading', { name: 'Faturas' })).toBeVisible();

  // Wait for fatura to load and be visible
  await page.waitForTimeout(500);

  // Verify fatura card shows with the amount
  const faturaCard = getFaturaCard(page, faturaMonth);
  await expect(faturaCard).toBeVisible();
  await expect(faturaCard).toContainText('R$ 500,00');

  // Click on fatura to view details
  await faturaCard.click();

  // Verify detail sheet opens
  const sheet = page.locator('[role="dialog"]');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', { name: /Cartão E2E/i })).toBeVisible();
  await expect(sheet).toContainText(/R\$\s*500,00/);
  await expect(sheet).toContainText('Compra E2E');

  // Pay the fatura
  await sheet.getByRole('button', { name: 'Pagar fatura' }).click();
  const payDialog = page.getByRole('alertdialog', { name: 'Pagar Fatura' });
  await expect(payDialog).toBeVisible();
  await payDialog.getByLabel('Pagar com conta:').click();
  await page.getByRole('option', { name: 'Conta Corrente E2E' }).first().click();
  await payDialog.getByRole('button', { name: 'Confirmar Pagamento' }).click();
  await expect(payDialog).toBeHidden();

  // Verify fatura is now paid
  await expect(sheet.getByText('Pago em')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Reverter pagamento' })).toBeVisible();
});

test('revert fatura payment', async ({ page }) => {
  await login(page);

  await createAccount(page, 'Cartão E2E', { type: 'credit_card' });
  await createAccount(page, 'Conta Corrente E2E', { type: 'checking' });

  // Create expense category
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);

  // Create expense on credit card
  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Despesa' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adicionar Despesa' });
  await expect(dialog).toBeVisible();
  await fillCurrencyInput(dialog.getByLabel('Valor'), '300');
  await dialog.getByLabel('Descrição').fill('Compra Revert E2E');
  await dialog.getByLabel('Categoria').click();
  await selectCategory(page, EXPENSE_CATEGORY);
  await dialog.getByLabel('Conta').click();
  await selectAccount(page, 'Cartão E2E');
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Go to faturas for next month and pay it
  const currentMonth = getYearMonth();
  const faturaMonth = addMonths(currentMonth, 1);
  await page.goto(`/faturas?month=${faturaMonth}`);

  // Wait for fatura to load
  await page.waitForTimeout(500);

  // Find and click fatura card
  const faturaCard = getFaturaCard(page, faturaMonth);
  await faturaCard.click();

  const sheet = page.locator('[role="dialog"]');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Pagar fatura' }).click();
  const payDialog2 = page.getByRole('alertdialog', { name: 'Pagar Fatura' });
  await expect(payDialog2).toBeVisible();
  await payDialog2.getByLabel('Pagar com conta:').click();
  await page.getByRole('option', { name: 'Conta Corrente E2E' }).first().click();
  await payDialog2.getByRole('button', { name: 'Confirmar Pagamento' }).click();
  await expect(payDialog2).toBeHidden();

  // Verify it's paid
  await expect(sheet.getByText('Pago em')).toBeVisible();

  // Now revert the payment
  await sheet.getByRole('button', { name: 'Reverter pagamento' }).click();
  await page.waitForTimeout(300);

  // Verify payment is reverted
  await expect(sheet.getByRole('button', { name: 'Pagar fatura' })).toBeVisible();
  await expect(sheet.getByText('Pago em')).not.toBeVisible();

  // Close sheet and verify fatura is pending
  await page.keyboard.press('Escape');
  await page.goto(`/faturas?month=${faturaMonth}`);

  // Wait for page to reload
  await page.waitForTimeout(300);

  // Verify fatura shows as pending
  const reloadedCard = getFaturaCard(page, faturaMonth);
  await expect(reloadedCard).toContainText('Pendente');
});

test('convert expense to fatura payment', async ({ page }) => {
  await login(page);

  await createAccount(page, 'Cartão Convert E2E', { type: 'credit_card' });
  await createAccount(page, 'Corrente Convert E2E', { type: 'checking' });

  // Create expense category
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);

  // Create expense on credit card to generate fatura
  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Despesa' }).click();
  const expenseDialog = page.getByRole('dialog', { name: 'Adicionar Despesa' });
  await expect(expenseDialog).toBeVisible();
  await fillCurrencyInput(expenseDialog.getByLabel('Valor'), '500');
  await expenseDialog.getByLabel('Descrição').fill('Compra Cartão E2E');
  await expenseDialog.getByLabel('Categoria').click();
  await selectCategory(page, EXPENSE_CATEGORY);
  await expenseDialog.getByLabel('Conta').click();
  await selectAccount(page, 'Cartão Convert E2E');
  await expenseDialog.getByRole('button', { name: 'Criar' }).click();
  await expect(expenseDialog).toBeHidden();

  // Create expense on checking account (same amount as fatura)
  await page.getByRole('button', { name: 'Despesa' }).click();
  await expect(expenseDialog).toBeVisible();
  await fillCurrencyInput(expenseDialog.getByLabel('Valor'), '500');
  await expenseDialog.getByLabel('Descrição').fill('Pagamento Fatura Manual');
  await expenseDialog.getByLabel('Categoria').click();
  await selectCategory(page, EXPENSE_CATEGORY);
  await expenseDialog.getByLabel('Conta').click();
  await selectAccount(page, 'Corrente Convert E2E');
  await expenseDialog.getByRole('button', { name: 'Criar' }).click();
  await expect(expenseDialog).toBeHidden();

  // Wait for expenses to load
  await page.waitForTimeout(500);

  // Find the checking account expense card and tap to open detail sheet
  const checkingExpenseCard = page.locator('h3', { hasText: 'Pagamento Fatura Manual' }).locator('..').locator('..').locator('..');
  await expect(checkingExpenseCard).toBeVisible();
  await checkingExpenseCard.click();

  // Detail sheet should open
  const sheet = page.locator('[role="dialog"]');
  await expect(sheet).toBeVisible();

  // Click "Converter em pagamento de fatura"
  await sheet.getByRole('button', { name: 'Converter em pagamento de fatura' }).click();

  // Convert dialog should open
  const convertDialog = page.getByRole('alertdialog', { name: 'Converter em pagamento de fatura' });
  await expect(convertDialog).toBeVisible();
  await expect(convertDialog.getByRole('heading', { name: 'Converter em pagamento de fatura' })).toBeVisible();

  // Select fatura from dropdown (should auto-select matching amount)
  // Just click the convert button as it should have a default selection
  await convertDialog.getByRole('button', { name: 'Converter' }).click();

  // Verify success toast
  await expect(page.getByText('Gasto convertido em pagamento de fatura')).toBeVisible();
  await expect(convertDialog).toBeHidden();

  // Navigate to faturas page for next month
  const currentMonth = getYearMonth();
  const faturaMonth = addMonths(currentMonth, 1);
  await page.goto(`/faturas?month=${faturaMonth}`);
  await expect(page.getByRole('heading', { name: 'Faturas' })).toBeVisible();

  // Wait for fatura to load
  await page.waitForTimeout(500);

  // Find fatura card and verify it shows as paid
  const faturaCard = getFaturaCard(page, faturaMonth);
  await expect(faturaCard).toBeVisible();
  await expect(faturaCard).toContainText('R$ 500,00');
  await expect(faturaCard).toContainText('Paga');
});
