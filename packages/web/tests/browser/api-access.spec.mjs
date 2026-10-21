import { expect, test } from '@playwright/test';
import { startPages } from '../helpers/pages.mjs';

let origin;
let cleanup;
test.beforeAll(async () => {
  const now = Math.floor(Date.now() / 1000);
  ({ origin } = await startPages({ after(fn) { cleanup = fn; } }, { seedSQL: `
    INSERT INTO user (id, email, created_at, plan) VALUES ('paid-ui', 'paid-ui@example.test', ${now}, 'pro');
    INSERT INTO session VALUES ('paid-ui-session', 'paid-ui', ${now + 3600});
    INSERT INTO api_entitlement VALUES ('paid-ui', 'sub_ui', 'price_ui', ${now - 60}, ${now + 3600}, 100);
    INSERT INTO api_usage VALUES ('paid-ui', ${now - 60}, 32, ${now}, 1);
  ` }));
});
test.afterAll(async () => { await cleanup?.(); });

test('customers create, retain, copy and revoke integration keys without activating billing', async ({ page, context }) => {
  await page.goto(`${origin}/signup`);
  await expect(page.locator('#svelte-announcer')).toBeAttached();
  await page.getByLabel('Email').fill('api-browser@example.test');
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  await page.getByRole('link', { name: 'Continue to dashboard' }).click();
  await page.getByRole('link', { name: 'API access', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'API access', exact: true })).toBeVisible();
  await expect(page.getByText('No active API subscription', { exact: true })).toBeVisible();
  await page.getByLabel('Key label').fill('Laboratory LIMS');
  await page.getByRole('button', { name: 'Create API key', exact: true }).click();
  const key = page.getByRole('textbox', { name: 'Your new API key' });
  await expect(key).toHaveText(/iscn_api_[a-f0-9]{64}/);
  const secret = await key.textContent();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy API key' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(secret);
  await expect(key).toBeVisible();
  const response = await page.request.post(`${origin}/api/v1/validate`, {
    headers: { Authorization: `Bearer ${secret}` }, data: { karyotype: '46,XX' },
  });
  expect(response.status()).toBe(402);
  await page.getByRole('button', { name: 'I have saved this key' }).click();
  await expect(key).toHaveCount(0);
  await page.reload();
  expect(await page.content()).not.toContain(secret);
  await page.getByRole('button', { name: 'Revoke Laboratory LIMS', exact: true }).click();
  await expect(page.getByText('Revoked', { exact: true })).toBeVisible();
  const revoked = await page.request.post(`${origin}/api/v1/validate`, {
    headers: { Authorization: `Bearer ${secret}` }, data: { karyotype: '46,XX' },
  });
  expect(revoked.status()).toBe(401);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '/private/tmp/iscn-api-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Billing', exact: true }).click();
  await expect(page.getByText('Paid checkout is not available yet', { exact: true })).toBeVisible();
});

test('a paid account sees its shared allowance and integration documentation', async ({ page, context }) => {
  await context.addCookies([{ name: 'iscn_session', value: 'paid-ui-session', url: origin }]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/dashboard/api`);
  await expect(page.getByText('68 validations remaining', { exact: true })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '32');
  await page.screenshot({ path: '/private/tmp/iscn-api-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'API guide →', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hosted validation API', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Handle failures and retries' })).toBeVisible();
});
