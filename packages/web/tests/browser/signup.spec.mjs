import { expect, test } from '@playwright/test';
import { startPages } from '../helpers/pages.mjs';

let origin;
let cleanup;
test.beforeAll(async () => {
  ({ origin } = await startPages({ after(fn) { cleanup = fn; } }));
});
test.afterAll(async () => { await cleanup?.(); });

test('signup keeps the one-time API key visible until the user continues', async ({ page }) => {
  await page.goto(`${origin}/signup`);
  await expect(page.locator('#svelte-announcer')).toBeAttached();
  await page.getByLabel('Email').fill('browser-regression@example.test');
  const submission = page.waitForRequest((request) =>
    request.method() === 'POST' && new URL(request.url()).pathname === '/signup');
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();
  expect((await submission).headers()['x-sveltekit-action']).toBe('true');
  await expect(page.getByRole('heading', { name: 'Account created' })).toBeVisible();
  await expect(page.locator('.plaintext-reveal code')).toHaveText(/iscn_live_[a-f0-9]{32}/);
  await expect(page).toHaveURL(`${origin}/signup`);
  await page.getByRole('link', { name: 'Continue to dashboard' }).click();
  await expect(page).toHaveURL(`${origin}/dashboard`);
  await expect(page.getByText('browser-regression@example.test', { exact: false })).toBeVisible();
});
