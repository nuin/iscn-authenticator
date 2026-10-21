import { expect, test } from '@playwright/test';
import { startPages } from '../helpers/pages.mjs';

let app;
let cleanup;
test.beforeAll(async () => { app = await startPages({ after(fn) { cleanup = fn; } }); });
test.afterAll(async () => { await cleanup?.(); });

test('signup can correct an email and complete verification without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(`${app.origin}/signup`);
    await page.getByLabel('Email', { exact: true }).fill('mistyped@example.test');
    await page.getByRole('button', { name: 'Send email code', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await page.getByRole('button', { name: 'Use a different email' }).click();
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await page.getByLabel('Email', { exact: true }).fill('no-javascript@example.test');
    await page.getByRole('button', { name: 'Send email code', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await page.getByLabel('Email code', { exact: true }).fill(await app.emailCode('no-javascript@example.test'));
    await page.getByRole('button', { name: 'Verify email and continue' }).click();
    await expect(page).toHaveURL(`${app.origin}/dashboard`);
  } finally { await context.close(); }
});

test('email signup, sign-in and recovery work with enhanced forms', async ({ page, context }) => {
  const email = 'browser-regression@example.test';
  await page.goto(`${app.origin}/signup`);
  await expect(page.locator('#svelte-announcer')).toBeAttached();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send email code', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  expect((await context.cookies()).some((cookie) => cookie.name === 'iscn_session')).toBe(false);
  await page.getByLabel('Email code', { exact: true }).fill(await app.emailCode(email));
  await page.getByRole('button', { name: 'Verify email and continue' }).click();
  await expect(page).toHaveURL(`${app.origin}/dashboard`);
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  const firstSession = (await context.cookies()).find((cookie) => cookie.name === 'iscn_session').value;
  await app.executeSQL('UPDATE email_auth_limit SET resets_at = 0');
  await page.goto(`${app.origin}/recover`);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send email code', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '/private/tmp/iscn-email-code-mobile.png', fullPage: true });
  await page.getByLabel('Email code', { exact: true }).fill(await app.emailCode(email));
  await page.getByRole('button', { name: 'Recover account', exact: true }).click();
  await expect(page).toHaveURL(`${app.origin}/dashboard`);
  const oldSession = await fetch(`${app.origin}/dashboard`, { redirect: 'manual', headers: { cookie: `iscn_session=${firstSession}` } });
  expect(oldSession.status).toBe(302);
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(`${app.origin}/login`);
  await app.executeSQL('UPDATE email_auth_limit SET resets_at = 0');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Send email code', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await page.getByLabel('Email code', { exact: true }).fill(await app.emailCode(email));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(`${app.origin}/dashboard`);
});
