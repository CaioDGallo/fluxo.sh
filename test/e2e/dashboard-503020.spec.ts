import { type Page } from '@playwright/test';
import { test, expect } from '@/test/fixtures';
import { budgets, categories } from '@/lib/schema';
import { dismissOnboarding } from './onboarding';

const TEST_EMAIL = 'e2e@example.com';
const TEST_PASSWORD = 'Password123';
const E2E_USER_ID = process.env.E2E_AUTH_USER_ID ?? '00000000-0000-4000-8000-000000000001';
type DbClient = typeof import('@/lib/db').db;

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(TEST_EMAIL);
  await page.getByLabel('Senha').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await dismissOnboarding(page);
  await expect(page.getByRole('heading', { name: 'Meu Fluxo' })).toBeVisible();
}

async function seedBudgets(db: DbClient) {
  const yearMonth = new Date().toISOString().slice(0, 7);
  const [category] = await db
    .insert(categories)
    .values({
      userId: E2E_USER_ID,
      name: 'Categoria Orçamento E2E',
      color: '#ef4444',
      icon: 'Restaurant01Icon',
      type: 'expense',
      bucket: 'wants',
    })
    .returning({ id: categories.id });

  await db.insert(budgets).values({
    userId: E2E_USER_ID,
    categoryId: category.id,
    yearMonth,
    amount: 300000,
  });
}

test.describe('Dashboard 50/30/20', () => {
  test.describe('with budgets', () => {
    test.beforeEach(async ({ page, db }) => {
      await seedBudgets(db);
      await login(page);
    });

    test('shows safe-to-spend hero with daily amount', async ({ page }) => {
      // Check for "Disponível para Gastar" text
      await expect(page.getByText('Disponível para Gastar')).toBeVisible();

      // Check for "por dia" text
      await expect(page.getByText('por dia')).toBeVisible();

      // Check for days remaining indicator
      await expect(page.getByText(/\d+ dias restantes/).first()).toBeVisible();
    });

    test('displays three bucket cards', async ({ page }) => {
      // Check for all three bucket labels
      await expect(page.getByRole('link', { name: /Necessidades/ }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: /Desejos/ }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: /Poupança/ }).first()).toBeVisible();
    });

    test('safe-to-spend shows pacing zone bar with labels', async ({ page }) => {
      // Check that zone labels are visible (Portuguese text)
      await expect(page.getByText('Economizando', { exact: false }).first()).toBeVisible();

      // Check for zone ranges
      await expect(page.getByText('0-90%')).toBeVisible();
      await expect(page.getByText('90-110%')).toBeVisible();
      await expect(page.getByText('110-130%')).toBeVisible();
      await expect(page.getByText('130%+')).toBeVisible();

      // Verify progressbar role for accessibility
      const zonebar = page.getByRole('progressbar', { name: /^\d+%$/ });
      await expect(zonebar).toBeVisible();
    });

    test('displays preset selector button', async ({ page }) => {
      // Check for settings button (preset selector)
      const presetButton = page.getByRole('button', { name: /Na Risca|Entrando na Linha|Saindo das dívidas/ });
      await expect(presetButton).toBeVisible();
    });

    test('preset selector dialog opens and displays options', async ({ page }) => {
      // Click preset selector button
      const presetButton = page.getByRole('button', { name: /Na Risca|Entrando na Linha|Saindo das dívidas/ });
      await presetButton.click();

      // Check dialog appears
      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();

      // Check for dialog title
      await expect(dialog.getByText('Configurar Método 50/30/20')).toBeVisible();

      // Check for both preset options
      await expect(dialog.getByText('Na Risca')).toBeVisible();
      await expect(dialog.getByText('Entrando na Linha')).toBeVisible();
      await expect(dialog.getByText('Saindo das dívidas')).toBeVisible();

      // Check for descriptions
      await expect(dialog.getByText('50% Necessidades, 30% Desejos, 20% Poupança')).toBeVisible();
      await expect(dialog.getByText('60% Necessidades, 30% Desejos, 10% Poupança')).toBeVisible();
      await expect(dialog.getByText('70% Necessidades, 25% Desejos, 5% Poupança')).toBeVisible();

      // Close dialog
      await dialog.getByRole('button', { name: 'Cancelar' }).click();
      await expect(dialog).not.toBeVisible();
    });
  });

  test.describe('without budgets', () => {
    test.beforeEach(async ({ page }) => {
      await login(page);
    });

    test('displays "Meu Fluxo" heading', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Meu Fluxo' })).toBeVisible();
    });

    test('displays no budgets message when no budgets configured', async ({ page }) => {
      // Should show no budgets message
      await expect(page.getByText('Nenhum orçamento definido para este mês')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Definir Orçamentos' })).toBeVisible();
    });

    test('month picker is functional', async ({ page }) => {
      const prevButton = page.getByRole('button', { name: 'Mês anterior' });
      const nextButton = page.getByRole('button', { name: 'Próximo mês' });
      await expect(prevButton).toBeVisible();
      await expect(nextButton).toBeVisible();
    });
  });
});
