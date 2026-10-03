import { expect, test } from '@playwright/test';
import { register, shot } from './helpers';

test('protected pages send signed-out users to the login page', async ({ page }) => {
  await page.goto('/targets');
  await expect(page).toHaveURL(/\/login\?next=%2Ftargets/);
});

test('login rejects open redirects in the next parameter', async ({ page, baseURL }) => {
  const email = await register(page, 'redirect');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/login?next=//evil.example/steal');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('end to end passphrase');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  const landed = new URL(page.url());
  expect(landed.origin).toBe(new URL(baseURL!).origin);
  expect(landed.pathname).toBe('/');
});

test('the target form refuses internal addresses (SSRF guard)', async ({ page }) => {
  await register(page, 'ssrf');
  await page.goto('/targets/new');
  await page.getByLabel('Name').fill('Internal database');
  await page.getByLabel('Base URL').fill('http://169.254.169.254/latest/meta-data/');
  await page.getByRole('button', { name: 'Save target' }).click();
  await expect(page.locator('main [role="alert"]')).toContainText('blocked range');
  await shot(page, '06-ssrf-blocked');
});

test('user-supplied text is rendered as text, never as HTML', async ({ page }) => {
  let dialog = false;
  page.on('dialog', async (d) => {
    dialog = true;
    await d.dismiss();
  });
  await register(page, 'xss');
  const payload = '<img src=x onerror=alert(1)>';
  await page.goto('/targets/new');
  await page.getByLabel('Name').fill(payload);
  await page.getByLabel('Base URL').fill('https://93.184.215.14/');
  await page.getByRole('button', { name: 'Save target' }).click();
  await expect(page.getByRole('heading', { name: payload })).toBeVisible();
  await page.goto('/targets');
  await expect(page.getByRole('link', { name: payload })).toBeVisible();
  expect(dialog).toBe(false);
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
});

test('scanning stays blocked until authorization is confirmed', async ({ page }) => {
  await register(page, 'authz');
  await page.goto('/targets/new');
  await page.getByLabel('Name').fill('Unconfirmed');
  await page.getByLabel('Base URL').fill('https://93.184.215.14/');
  await page.getByRole('button', { name: 'Save target' }).click();
  await expect(page.getByText('Authorization required before scanning')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start scan' })).toBeDisabled();
});
