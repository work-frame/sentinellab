import { expect, type Page } from '@playwright/test';

export async function register(page: Page, label = 'e2e') {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Name').fill('E2E Tester');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('end to end passphrase');
  await page.getByLabel('Confirm password').fill('end to end passphrase');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  return email;
}

export async function shot(page: Page, name: string) {
  if (process.env.E2E_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.E2E_SCREENSHOT_DIR}/${name}.png`, fullPage: true });
}
