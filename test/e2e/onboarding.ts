import { type Locator, type Page } from '@playwright/test';

export async function dismissOnboarding(page: Page, readyHeading?: Locator) {
  const introDialog = page.getByRole('dialog', { name: 'Primeiros passos' });
  const heading = readyHeading ?? page.getByRole('heading', { name: 'Meu Fluxo' });
  const rateLimit = page.getByText('Too Many Requests');
  const deadline = Date.now() + 8000;
  let headingSeenAt: number | null = null;

  while (Date.now() < deadline) {
    if (await rateLimit.isVisible().catch(() => false)) {
      await page.waitForTimeout(2000);
      await page.reload();
      headingSeenAt = null;
      continue;
    }

    if (await introDialog.isVisible().catch(() => false)) {
      await introDialog.getByRole('button', { name: 'Pular' }).click();
      await introDialog.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
      return;
    }

    if (await heading.isVisible().catch(() => false)) {
      if (!headingSeenAt) {
        headingSeenAt = Date.now();
      }

      if (Date.now() - headingSeenAt > 800) {
        return;
      }
    }

    await page.waitForTimeout(200);
  }
}
