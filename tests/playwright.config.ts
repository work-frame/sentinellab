import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against a running stack: web on :3000 (proxying the API)
 * and the demo targets on :8081 and :8082. Start them with
 * `docker compose up -d` or the local dev commands in docs/DEVELOPMENT.md.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use a preinstalled Chromium when one is provided (for example in a sandbox).
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
      },
    },
  ],
});
