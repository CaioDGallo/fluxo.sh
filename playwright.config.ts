import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      E2E_AUTH_BYPASS: 'true',
      NEXT_PUBLIC_E2E_AUTH_BYPASS: 'true',
      E2E_AUTH_USER_ID: process.env.E2E_AUTH_USER_ID ?? '00000000-0000-4000-8000-000000000001',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY:
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA',
    },
  },
});
