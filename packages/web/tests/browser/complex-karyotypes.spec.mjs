import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { startPages } from '../helpers/pages.mjs';

const cases = JSON.parse(await readFile(new URL('../../../core/tests/data/complex-karyotypes.json', import.meta.url), 'utf8'));
let origin;
let cleanup;
test.beforeAll(async () => {
  ({ origin } = await startPages({ after(fn) { cleanup = fn; } }));
});
test.afterAll(async () => { await cleanup?.(); });

test('complex notation produces the expected user-visible status for every synthetic case', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${origin}/validate`);
  await expect(page.locator('#svelte-announcer')).toBeAttached();
  const requests = [];
  page.on('request', (request) => requests.push({ url: request.url(), body: request.postData() }));
  expect(cases).toHaveLength(72);
  for (const example of cases) {
    await test.step(`${example.id}: ${example.purpose}`, async () => {
      await page.getByLabel('ISCN notation', { exact: true }).fill(example.input);
      await page.getByRole('button', { name: 'Check karyotype' }).click();
      await expect(page.getByRole('heading', { name: example.status, exact: true })).toBeVisible();
      if (example.status === 'Review required') {
        await expect(page.getByLabel('Coverage limitations')).toBeVisible();
      }
    });
  }
  expect(errors).toEqual([]);
  expect(requests.filter((request) => request.body)).toEqual([]);
  for (const example of cases) {
    expect(requests.some((request) => decodeURIComponent(request.url).includes(example.input))).toBe(false);
  }
});
