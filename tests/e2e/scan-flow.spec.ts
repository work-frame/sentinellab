import { expect, test } from '@playwright/test';
import { register, shot } from './helpers';

test('register, add a demo target, scan it, triage a finding and download a report', async ({ page }) => {
  await register(page, 'flow');
  await expect(page.getByText('No targets yet')).toBeVisible();
  await shot(page, '01-dashboard-empty');

  await page.getByRole('link', { name: 'Demo Lab' }).first().click();
  await expect(page.getByText('INTENTIONALLY VULNERABLE — LOCAL SECURITY TRAINING TARGET').first()).toBeVisible();
  const card = page.locator('article', { hasText: 'vulnerable-web' });
  const addButton = card.getByRole('button', { name: 'Add to my targets' });
  await expect(addButton).toBeDisabled();
  await card.getByRole('checkbox').check();
  await addButton.click();
  await shot(page, '02-demo-lab');
  await card.getByRole('button', { name: 'Scan now' }).click();

  await expect(page).toHaveURL(/\/scans\//);
  await expect(page.locator('main').getByText('Completed', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: 'Content-Security-Policy header is missing' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Cookie "PHPSESSID" is readable by JavaScript/ })).toBeVisible();
  await shot(page, '03-scan-completed');

  await page.getByRole('link', { name: /Cookie "PHPSESSID" is readable by JavaScript/ }).click();
  await expect(page.getByRole('heading', { name: 'Remediation' })).toBeVisible();
  await expect(page.getByText('PHPSESSID=[REDACTED]').first()).toBeVisible();
  await expect(page.getByText('demo-not-a-real-session')).toHaveCount(0);
  await page.getByLabel('Status').selectOption('CONFIRMED');
  await page.getByLabel('Note').fill('Reproduced in the browser dev tools.');
  await page.getByRole('button', { name: 'Save status' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved.' })).toBeVisible();
  await shot(page, '04-finding-detail');

  await page.getByRole('link', { name: 'Scan', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'HTML report' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^sentinellab-report-.*\.html$/);

  await page.getByRole('link', { name: 'Reports' }).first().click();
  await expect(page.getByRole('link', { name: /Security assessment: Demo: vulnerable-web/ })).toBeVisible();

  await page.getByRole('link', { name: 'Dashboard' }).first().click();
  await expect(page.getByText('Open findings by severity')).toBeVisible();
  await expect(page.getByText('Recently discovered')).toBeVisible();
  await shot(page, '05-dashboard');
});

test('the API demo target produces a high severity CORS finding', async ({ page }) => {
  await register(page, 'cors');
  await page.goto('/demo-lab');
  const card = page.locator('article', { hasText: 'vulnerable-api' });
  await card.getByRole('checkbox').check();
  await card.getByRole('button', { name: 'Add to my targets' }).click();
  await card.getByRole('button', { name: 'Scan now' }).click();
  await expect(page.getByRole('link', { name: 'CORS reflects any origin and allows credentials' })).toBeVisible({ timeout: 30_000 });
  await page.goto('/findings?severity=HIGH');
  await expect(page.getByRole('link', { name: 'CORS reflects any origin and allows credentials' })).toBeVisible();
});
