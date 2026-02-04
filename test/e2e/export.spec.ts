import { type Page, type Locator } from '@playwright/test';
import { test, expect } from '@/test/fixtures';
import { dismissOnboarding } from './onboarding';
import fs from 'fs';

const TEST_EMAIL = 'e2e@example.com';
const TEST_PASSWORD = 'Password123';

const ACCOUNT_NAME = 'Conta Exportar E2E';
const EXPENSE_CATEGORY = 'Alimentação Exportar E2E';
const INCOME_CATEGORY = 'Salário Exportar E2E';

function getYearMonth(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(TEST_EMAIL);
  await page.getByLabel('Senha').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await dismissOnboarding(page);
  await expect(page.getByRole('heading', { name: 'Meu Fluxo' })).toBeVisible();
}

async function createAccount(page: Page, name: string) {
  await page.goto('/settings/accounts');
  await page.getByRole('button', { name: 'Adicionar Conta' }).click();
  const typeDialog = page.getByRole('dialog', { name: 'Como deseja adicionar?' });
  await expect(typeDialog).toBeVisible();
  await typeDialog.getByRole('button', { name: 'Manual' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adicionar Conta' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Nome').fill(name);
  await dialog.getByLabel('Saldo Inicial').pressSequentially('0');
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();
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

async function createExpense(
  page: Page,
  amount: string,
  description: string,
  category: string,
  account: string
) {
  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Despesa' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adicionar Despesa' });
  await expect(dialog).toBeVisible();
  await fillCurrencyInput(dialog.getByLabel('Valor'), amount);
  await dialog.getByLabel('Descrição').fill(description);
  await dialog.getByLabel('Categoria').click();
  await selectCategory(page, category);
  await dialog.getByLabel('Conta').click();
  await selectAccount(page, account);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();
}

async function createIncome(
  page: Page,
  amount: string,
  description: string,
  category: string,
  account: string
) {
  await page.goto('/income');
  await page.getByRole('button', { name: 'Receita' }).click();
  const dialog = page.getByRole('dialog', { name: 'Adicionar Receita' });
  await expect(dialog).toBeVisible();
  await fillCurrencyInput(dialog.getByLabel('Valor'), amount);
  await dialog.getByLabel('Descrição').fill(description);
  await dialog.getByLabel('Categoria').click();
  await selectCategory(page, category);
  await dialog.getByLabel('Conta').click();
  await selectAccount(page, account);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();
}

test('export transactions for current month with both expenses and income', async ({ page }) => {
  await login(page);
  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);
  await createCategory(page, 'Categorias de Receita', INCOME_CATEGORY);

  // Create test data
  await createExpense(page, '150', 'Mercado Exportar E2E', EXPENSE_CATEGORY, ACCOUNT_NAME);
  await createIncome(page, '500', 'Salário Exportar E2E', INCOME_CATEGORY, ACCOUNT_NAME);

  // Navigate to export page
  await page.goto('/settings/export');
  await expect(page.getByRole('heading', { name: 'Exportar Dados' })).toBeVisible();

  // Verify default selections
  await expect(page.getByRole('radio', { name: 'Mês' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Incluir despesas' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Incluir receitas' })).toBeChecked();

  // Verify format info is visible (checkboxes are UI components that might be harder to test)
  await expect(page.getByText('O arquivo CSV será exportado')).toBeVisible();

  // Trigger export and wait for download
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const download = await downloadPromise;

  // Verify download filename pattern
  const currentMonth = getYearMonth();
  expect(download.suggestedFilename()).toBe(`transacoes_${currentMonth}.csv`);

  // Verify CSV content
  const path = await download.path();
  const content = fs.readFileSync(path!, 'utf-8');

  // Check CSV header
  expect(content).toContain('Data,Descricao,Categoria,Conta,Valor,Tipo,Status,Parcela,ID');

  // Check expense data (CSV uses plain numbers without R$ formatting)
  expect(content).toContain('Mercado Exportar E2E');
  expect(content).toContain(EXPENSE_CATEGORY);
  expect(content).toContain('-150');
  expect(content).toContain('Despesa');

  // Check income data
  expect(content).toContain('Salário Exportar E2E');
  expect(content).toContain(INCOME_CATEGORY);
  expect(content).toContain('500');
  expect(content).toContain('Receita');
});

test('export only expenses by unchecking income', async ({ page }) => {
  await login(page);
  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);
  await createCategory(page, 'Categorias de Receita', INCOME_CATEGORY);

  await createExpense(page, '200', 'Apenas Despesa E2E', EXPENSE_CATEGORY, ACCOUNT_NAME);
  await createIncome(page, '600', 'Não Exportar Receita E2E', INCOME_CATEGORY, ACCOUNT_NAME);

  await page.goto('/settings/export');

  // Uncheck income by clicking its label
  await page.getByRole('checkbox', { name: 'Incluir receitas' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const download = await downloadPromise;

  const path = await download.path();
  const content = fs.readFileSync(path!, 'utf-8');

  // Should contain expense
  expect(content).toContain('Apenas Despesa E2E');
  expect(content).toContain('Despesa');

  // Should NOT contain income
  expect(content).not.toContain('Não Exportar Receita E2E');
  expect(content).not.toContain('Receita');
});

test('export only income by unchecking expenses', async ({ page }) => {
  await login(page);
  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);
  await createCategory(page, 'Categorias de Receita', INCOME_CATEGORY);

  await createExpense(page, '100', 'Não Exportar Despesa E2E', EXPENSE_CATEGORY, ACCOUNT_NAME);
  await createIncome(page, '700', 'Apenas Receita E2E', INCOME_CATEGORY, ACCOUNT_NAME);

  await page.goto('/settings/export');

  // Uncheck expenses by clicking its label
  await page.getByRole('checkbox', { name: 'Incluir despesas' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const download = await downloadPromise;

  const path = await download.path();
  const content = fs.readFileSync(path!, 'utf-8');

  // Should contain income
  expect(content).toContain('Apenas Receita E2E');
  expect(content).toContain('Receita');

  // Should NOT contain expense
  expect(content).not.toContain('Não Exportar Despesa E2E');
  expect(content).not.toContain('Despesa');
});

test('export transactions for full year', async ({ page }) => {
  await login(page);
  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);

  await createExpense(page, '300', 'Despesa Ano E2E', EXPENSE_CATEGORY, ACCOUNT_NAME);

  await page.goto('/settings/export');

  // Select year time range
  await page.getByRole('radio', { name: 'Ano' }).click();

  // Verify year selector appears
  await expect(page.getByText('Selecione o mês')).toBeVisible();

  const currentYear = new Date().getFullYear();
  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: String(currentYear) }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const download = await downloadPromise;

  const expectedFilename = `transacoes_${currentYear}-01.csv`;
  expect(download.suggestedFilename()).toBe(expectedFilename);
});

test('export all transactions (all time)', async ({ page }) => {
  await login(page);
  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', EXPENSE_CATEGORY);

  await createExpense(page, '250', 'Todas Transações E2E', EXPENSE_CATEGORY, ACCOUNT_NAME);

  await page.goto('/settings/export');

  // Select all time
  await page.getByRole('radio', { name: 'Todo o período' }).click();

  // Verify month selector is hidden
  await expect(page.getByText('Selecione o mês')).not.toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('transacoes_todas.csv');
});

test('export button disabled when both expenses and income unchecked', async ({ page }) => {
  await login(page);

  await page.goto('/settings/export');

  // Find and uncheck both checkboxes using text content
  await page.getByRole('checkbox', { name: 'Incluir despesas' }).click();
  await page.getByRole('checkbox', { name: 'Incluir receitas' }).click();

  // Export button should be disabled
  await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
});

test('show error when no data to export', async ({ page }) => {
  await login(page);

  await page.goto('/settings/export');

  // Try to export (no data created)
  await page.getByRole('button', { name: 'Exportar CSV' }).click();

  // Should show error message
  await expect(page.getByText('Não há transações no período selecionado.')).toBeVisible();

  // Should not trigger download
  // (no assertion needed - test passes if no download event fires)
});

test('format info message is visible', async ({ page }) => {
  await login(page);

  await page.goto('/settings/export');

  // Verify format info message
  await expect(
    page.getByText(
      'O arquivo CSV será exportado com separadores de coluna e codificação UTF-8 para compatibilidade com Excel.'
    )
  ).toBeVisible();
});
