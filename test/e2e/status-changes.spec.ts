import { type Page } from '@playwright/test';
import { test, expect } from '@/test/fixtures';

const TEST_EMAIL = 'e2e@example.com';
const TEST_PASSWORD = 'Password123';

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
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Nome').fill(name);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name }).first()).toBeVisible();
}

async function createCategory(page: Page, heading: string, name: string) {
  await page.goto('/settings/categories');
  const section = page.getByRole('heading', { name: heading }).locator('..');
  await section.getByRole('button', { name: 'Adicionar' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Nome').fill(name);
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name }).first()).toBeVisible();
}

test('mark expense as paid', async ({ page }) => {
  await login(page);

  const ACCOUNT_NAME = 'Conta E2E';
  const CATEGORY_NAME = 'Alimentação E2E';
  const DESCRIPTION = 'Mercado E2E';

  // Setup
  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', CATEGORY_NAME);

  // Create expense (not paid by default)
  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Adicionar Despesa' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Valor').fill('100');
  await dialog.getByLabel('Descrição').fill(DESCRIPTION);
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: CATEGORY_NAME }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Find the expense card and open dropdown
  const expenseCard = page.locator('h3', { hasText: DESCRIPTION }).first().locator('../../..');
  await expenseCard.getByRole('button').last().click();

  // Wait for dropdown menu and click "Marcar como Pago"
  const markPaidMenuItem = page.getByRole('menuitem', { name: 'Marcar como Pago' });
  await expect(markPaidMenuItem).toBeVisible();
  await markPaidMenuItem.click();

  // Wait for the status update to process
  await page.waitForTimeout(500);

  // Verify: Open dropdown again and check for "Marcar como Pendente"
  await expenseCard.getByRole('button').last().click();
  await expect(page.getByRole('menuitem', { name: 'Marcar como Pendente' })).toBeVisible();
});

test('mark expense as pending (unpay)', async ({ page }) => {
  await login(page);

  const ACCOUNT_NAME = 'Conta E2E';
  const CATEGORY_NAME = 'Alimentação E2E';
  const DESCRIPTION = 'Mercado E2E';

  // Setup
  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Despesa', CATEGORY_NAME);

  // Create expense
  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Adicionar Despesa' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Valor').fill('100');
  await dialog.getByLabel('Descrição').fill(DESCRIPTION);
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: CATEGORY_NAME }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Find the expense card and open dropdown
  const expenseCard = page.locator('h3', { hasText: DESCRIPTION }).first().locator('../../..');

  // First mark as paid
  await expenseCard.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Marcar como Pago' }).click();
  await page.waitForTimeout(500);

  // Then mark as pending (unpay)
  await expenseCard.getByRole('button').last().click();
  const markPendingMenuItem = page.getByRole('menuitem', { name: 'Marcar como Pendente' });
  await expect(markPendingMenuItem).toBeVisible();
  await markPendingMenuItem.click();
  await page.waitForTimeout(500);

  // Verify: Open dropdown again and check for "Marcar como Pago" (back to unpaid)
  await expenseCard.getByRole('button').last().click();
  await expect(page.getByRole('menuitem', { name: 'Marcar como Pago' })).toBeVisible();
});

test('mark income as received', async ({ page }) => {
  await login(page);

  const ACCOUNT_NAME = 'Conta E2E';
  const CATEGORY_NAME = 'Salário E2E';
  const DESCRIPTION = 'Pagamento E2E';

  // Setup
  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Receita', CATEGORY_NAME);

  // Create income (not received by default)
  await page.goto('/income');
  await page.getByRole('button', { name: 'Adicionar Receita' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Valor').fill('2000');
  await dialog.getByLabel('Descrição').fill(DESCRIPTION);
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: CATEGORY_NAME }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Find the income card and open dropdown
  const incomeCard = page.locator('h3', { hasText: DESCRIPTION }).first().locator('../../..');
  await incomeCard.getByRole('button').last().click();

  // Wait for dropdown menu and click "Marcar como Recebido"
  const markReceivedMenuItem = page.getByRole('menuitem', { name: 'Marcar como Recebido' });
  await expect(markReceivedMenuItem).toBeVisible();
  await markReceivedMenuItem.click();

  // Wait for the status update to process
  await page.waitForTimeout(500);

  // Verify: Open dropdown again and check for "Marcar como Pendente"
  await incomeCard.getByRole('button').last().click();
  await expect(page.getByRole('menuitem', { name: 'Marcar como Pendente' })).toBeVisible();
});

test('mark income as pending (unreceive)', async ({ page }) => {
  await login(page);

  const ACCOUNT_NAME = 'Conta E2E';
  const CATEGORY_NAME = 'Salário E2E';
  const DESCRIPTION = 'Pagamento E2E';

  // Setup
  await createAccount(page, ACCOUNT_NAME);
  await createCategory(page, 'Categorias de Receita', CATEGORY_NAME);

  // Create income
  await page.goto('/income');
  await page.getByRole('button', { name: 'Adicionar Receita' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Valor').fill('1500');
  await dialog.getByLabel('Descrição').fill(DESCRIPTION);
  await dialog.getByLabel('Categoria').click();
  await page.getByRole('option', { name: CATEGORY_NAME }).first().click();
  await dialog.getByLabel('Conta').click();
  await page.getByRole('option', { name: ACCOUNT_NAME }).first().click();
  await dialog.getByRole('button', { name: 'Criar' }).click();
  await expect(dialog).toBeHidden();

  // Find the income card and open dropdown
  const incomeCard = page.locator('h3', { hasText: DESCRIPTION }).first().locator('../../..');

  // First mark as received
  await incomeCard.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Marcar como Recebido' }).click();
  await page.waitForTimeout(500);

  // Then mark as pending (unreceive)
  await incomeCard.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Marcar como Pendente' }).click();
  await page.waitForTimeout(500);

  // Verify: Open dropdown again and check for "Marcar como Recebido" (back to not received)
  await incomeCard.getByRole('button').last().click();
  await expect(page.getByRole('menuitem', { name: 'Marcar como Recebido' })).toBeVisible();
});
