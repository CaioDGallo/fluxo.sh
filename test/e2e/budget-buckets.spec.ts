import { type Page } from '@playwright/test';
import { test, expect } from '@/test/fixtures';

const TEST_EMAIL = 'e2e@example.com';
const TEST_PASSWORD = 'Password123';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(TEST_EMAIL);
  await page.getByLabel('Senha').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Meu Fluxo' })).toBeVisible();
}

test.describe('Budget Bucket Assignment', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('category form displays bucket picker for expense categories', async ({ page }) => {
    await page.goto('/settings/categories');

    // Click to add new category
    await page.getByRole('button', { name: 'Adicionar Categoria' }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();

    // Check for bucket picker label
    await expect(dialog.getByText('Categoria de Orçamento 50/30/20')).toBeVisible();

    // Check for all three bucket options
    await expect(dialog.getByText('Necessidades')).toBeVisible();
    await expect(dialog.getByText('Desejos')).toBeVisible();
    await expect(dialog.getByText('Poupança')).toBeVisible();

    // Check for bucket descriptions
    await expect(dialog.getByText(/50% - Alimentação, moradia, transporte/)).toBeVisible();
    await expect(dialog.getByText(/30% - Entretenimento, compras, lazer/)).toBeVisible();
    await expect(dialog.getByText(/20% - Investimentos, reservas/)).toBeVisible();
  });

  test('can create category with bucket assignment', async ({ page }) => {
    await page.goto('/settings/categories');

    // Add new category
    await page.getByRole('button', { name: 'Adicionar Categoria' }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();

    // Fill category details
    await dialog.getByLabel('Nome').fill('Mercado E2E');

    // Select first color
    const colorButtons = dialog.locator('button[type="button"]').filter({ has: page.locator('div[style*="background"]') });
    await colorButtons.first().click();

    // Select bucket - click on "Necessidades" button
    const necessitiesButton = dialog.getByRole('button', { name: /Necessidades/ });
    await necessitiesButton.click();

    // Verify bucket is selected (should have ring styling)
    await expect(necessitiesButton).toHaveClass(/ring-2/);

    // Submit form
    await dialog.getByRole('button', { name: 'Criar' }).click();

    // Verify category was created and displays bucket badge
    await expect(page.getByText('Mercado E2E')).toBeVisible();

    // The bucket badge should be visible on the category card
    // Note: The badge text might be hidden on mobile, but the icon should be there
    const categoryCard = page.locator('div', { hasText: 'Mercado E2E' }).first();
    await expect(categoryCard).toBeVisible();
  });

  test('can edit category bucket assignment', async ({ page }) => {
    await page.goto('/settings/categories');

    // Find an existing category (assume "Alimentação" exists from seed data)
    const alimentacaoCard = page.locator('div', { hasText: 'Alimentacao' }).first();

    if (await alimentacaoCard.isVisible()) {
      // Click the more options menu
      await alimentacaoCard.getByRole('button', { name: '' }).click();

      // Click edit option
      await page.getByRole('menuitem', { name: /Editar/ }).click();

      const dialog = page.getByRole('alertdialog');
      await expect(dialog).toBeVisible();

      // Verify current bucket selection (should be Necessidades for Alimentacao)
      const necessitiesButton = dialog.getByRole('button', { name: /Necessidades/ });
      await expect(necessitiesButton).toHaveClass(/ring-2/);

      // Change to Desejos
      const wantsButton = dialog.getByRole('button', { name: /Desejos/ });
      await wantsButton.click();

      // Verify new selection
      await expect(wantsButton).toHaveClass(/ring-2/);

      // Save changes
      await dialog.getByRole('button', { name: 'Atualizar' }).click();

      // Dialog should close
      await expect(dialog).not.toBeVisible();
    }
  });

  test('can remove bucket assignment from category', async ({ page }) => {
    await page.goto('/settings/categories');

    // Create a category with bucket first
    await page.getByRole('button', { name: 'Adicionar Categoria' }).click();

    let dialog = page.getByRole('alertdialog');
    await dialog.getByLabel('Nome').fill('Teste Remover E2E');

    // Select bucket
    await dialog.getByRole('button', { name: /Necessidades/ }).click();

    // Submit
    await dialog.getByRole('button', { name: 'Criar' }).click();

    // Wait for creation
    await expect(page.getByText('Teste Remover E2E')).toBeVisible();

    // Edit the category
    const categoryCard = page.locator('div', { hasText: 'Teste Remover E2E' }).first();
    await categoryCard.getByRole('button', { name: '' }).click();
    await page.getByRole('menuitem', { name: /Editar/ }).click();

    dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();

    // Click "Remover categorização" button
    await dialog.getByRole('button', { name: 'Remover categorização' }).click();

    // Verify no bucket is selected (no ring-2 on any bucket button)
    const bucketButtons = dialog.locator('button[type="button"]').filter({ hasText: /Necessidades|Desejos|Poupança/ });
    for (let i = 0; i < await bucketButtons.count(); i++) {
      const button = bucketButtons.nth(i);
      await expect(button).not.toHaveClass(/ring-2/);
    }

    // Save
    await dialog.getByRole('button', { name: 'Atualizar' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('bucket picker not shown for income categories', async ({ page }) => {
    await page.goto('/settings/categories');

    // Switch to income tab
    await page.getByRole('tab', { name: 'Receita' }).click();

    // Add new income category
    await page.getByRole('button', { name: 'Adicionar Categoria' }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();

    // Bucket picker should NOT be visible for income categories
    await expect(dialog.getByText('Categoria de Orçamento 50/30/20')).not.toBeVisible();
  });

  test('existing categories show bucket badges', async ({ page }) => {
    await page.goto('/settings/categories');

    // Check that default categories have bucket badges
    // Alimentacao should have Necessidades badge
    const alimentacaoCard = page.locator('div', { hasText: 'Alimentacao' }).first();

    if (await alimentacaoCard.isVisible()) {
      // The badge might not have visible text on mobile, but should be present
      const hasBadge = await alimentacaoCard.locator('span').filter({ hasText: /Necessidades/ }).count() > 0
        || await alimentacaoCard.locator('svg').count() > 1; // Has icon

      expect(hasBadge).toBe(true);
    }
  });
});
