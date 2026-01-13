import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

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

async function resetDatabase(request: APIRequestContext) {
  const response = await request.post('/api/test/reset');
  expect(response.ok()).toBeTruthy();
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(TEST_EMAIL);
  await page.getByLabel('Senha').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible();
}

async function createAccount(page: Page, name: string) {
  await page.goto('/settings/accounts');
  await page.getByRole('button', { name: 'Adicionar Conta' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome').fill(name);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(page.getByText(name)).toBeVisible();
}

async function createCategory(page: Page, heading: string, name: string) {
  await page.goto('/settings/categories');
  const section = page.getByRole('heading', { name: heading }).locator('..');
  await section.getByRole('button', { name: 'Adicionar' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome').fill(name);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(page.getByText(name)).toBeVisible();
}

async function setCategoryBudget(page: Page, categoryName: string, amount: string) {
  await page.goto('/settings/budgets');
  const row = page.getByText(categoryName, { exact: true }).locator('..').locator('..');
  const input = row.getByRole('spinbutton');
  await input.fill(amount);
  await input.blur();
  await expect(input).toHaveValue(amount);
}

test.beforeEach(async ({ request }) => {
  await resetDatabase(request);
});

test('login redirects to dashboard', async ({ page }) => {
  await login(page);
});

test('create account, category, and expense installments', async ({ page }) => {
  await login(page);

  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);
  await setCategoryBudget(page, EXPENSE_CATEGORY, '1000');

  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Adicionar Despesa' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Valor').fill('300');
  await dialog.getByLabel('Descrição').fill('Mercado E2E');
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: EXPENSE_CATEGORY }).click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).click();

  const slider = dialog.getByRole('slider');
  await slider.focus();
  await slider.press('ArrowRight');
  await slider.press('ArrowRight');

  await dialog.getByRole('button', { name: 'Criar' }).click();

  const currentMonth = getYearMonth();
  const months = [currentMonth, addMonths(currentMonth, 1), addMonths(currentMonth, 2)];

  for (const month of months) {
    await page.goto(`/expenses?month=${month}`);
    await expect(page.locator('h3', { hasText: 'Mercado E2E' })).toHaveCount(1);
  }

  await page.goto(`/dashboard?month=${currentMonth}`);
  const expensesBlock = page
    .locator('[data-slot="balance-summary"]')
    .locator('div', { hasText: 'Total de Despesas' })
    .first();
  await expect(expensesBlock).toContainText(/R\$\s*100,00/);
});

test('create income updates dashboard net balance', async ({ page }) => {
  await login(page);

  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);
  await createCategory(page, 'Categorias de Receita', INCOME_CATEGORY);
  await setCategoryBudget(page, EXPENSE_CATEGORY, '2000');

  await page.goto('/income');
  await page.getByRole('button', { name: 'Adicionar Receita' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Valor').fill('500');
  await dialog.getByLabel('Descrição').fill('Salário E2E');
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: INCOME_CATEGORY }).click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).click();
  await dialog.getByRole('button', { name: 'Criar' }).click();

  const currentMonth = getYearMonth();
  await page.goto(`/dashboard?month=${currentMonth}`);
  const netBlock = page
    .locator('[data-slot="balance-summary"]')
    .locator('div', { hasText: 'Saldo Líquido' })
    .first();
  await expect(netBlock).toContainText(/R\$\s*500,00/);
});

test('create transfer updates cash flow report', async ({ page }) => {
  await login(page);

  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);
  await setCategoryBudget(page, EXPENSE_CATEGORY, '1500');

  await page.goto('/transfers');
  await page.getByRole('button', { name: 'Adicionar Transferência' }).click();
  const dialog = page.getByRole('dialog');

  await dialog.getByLabel('Tipo').click();
  await page.getByRole('option', { name: 'Depósito' }).click();
  await dialog.getByLabel('Valor').fill('200');
  await dialog.getByLabel('Descrição').fill('Depósito E2E');
  await dialog.getByLabel('Conta de destino').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).click();
  await dialog.getByRole('button', { name: 'Criar' }).click();

  await expect(page.getByText('Depósito E2E')).toBeVisible();

  const currentMonth = getYearMonth();
  await page.goto(`/dashboard?month=${currentMonth}`);
  const transfersBlock = page
    .locator('[data-slot="cash-flow-report"]')
    .locator('div', { hasText: 'Transferências de entrada' })
    .first();
  await expect(transfersBlock).toContainText(/R\$\s*200,00/);
});
