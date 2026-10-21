import { expect, test } from '@playwright/test';
import { startPages } from '../helpers/pages.mjs';

let origin;
let cleanup;
test.beforeAll(async () => {
  ({ origin } = await startPages({ after(fn) { cleanup = fn; } }));
});
test.afterAll(async () => { await cleanup?.(); });

test('input remains beside the result while reviewing and exporting on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`${origin}/validate`);
  await expect(page.locator('#svelte-announcer')).toBeAttached();
  const input = page.getByLabel('ISCN notation', { exact: true });
  await input.fill('47,XX,+21[5]/46,XX[10]');
  await page.getByRole('button', { name: 'Check karyotype' }).click();
  const output = page.getByRole('region', { name: 'Validation output' });
  await expect(page.getByRole('heading', { name: 'Checks passed', exact: true })).toBeVisible();
  const entryBox = await input.boundingBox();
  const resultBox = await output.boundingBox();
  expect(entryBox.x + entryBox.width).toBeLessThan(resultBox.x);
  await page.getByRole('button', { name: 'Download JSON', exact: true }).scrollIntoViewIfNeeded();
  await expect(input).toBeInViewport({ ratio: 1, timeout: 3000 });
  await expect(page.getByRole('button', { name: 'Check karyotype' })).toBeInViewport();
  await input.fill('47,XX,+21[5]/47,XX,+99[10]');
  await expect(page.getByRole('heading', { name: 'Checks passed', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download JSON', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Check karyotype' }).click();
  await expect(page.getByRole('heading', { name: 'Issues found', exact: true })).toBeVisible();
  await expect(output).toContainText("Cell line 2: Invalid chromosome '99'");
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(input).toHaveValue('');
  await expect(output).not.toContainText('Issues found');
});

test('short desktop windows keep examples and guides reachable', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto(`${origin}/validate`);
  await expect(page.locator('#svelte-announcer')).toBeAttached();
  await page.getByRole('button', { name: /Multiple cell lines/ }).click();
  await expect(page.getByRole('heading', { name: 'Checks passed', exact: true })).toBeVisible();
  const guide = page.getByRole('link', { name: 'What the validator covers' });
  await guide.focus();
  await expect(guide).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${origin}/docs/coverage`);
});
