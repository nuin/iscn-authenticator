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
  expect(cases).toHaveLength(90);
  for (const example of cases) {
    await test.step(`${example.id}: ${example.purpose}`, async () => {
      await page.getByLabel('ISCN notation', { exact: true }).fill(example.input);
      await page.getByRole('button', { name: 'Check karyotype' }).click();
      await expect(page.getByRole('heading', { name: example.status, exact: true })).toBeVisible();
      if (example.status === 'Review required') {
        await expect(page.getByLabel('Coverage limitations')).toBeVisible();
      }
      if (example.id === 'C49') {
        await expect(page.locator('.cell-lines')).toContainText('94,idemx2[5]');
        await expect(page.locator('.cell-lines')).toContainText('References line 1 × 2');
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download JSON', exact: true }).click();
        const exported = JSON.parse(await readFile(await (await download).path(), 'utf8'));
        const line = exported.parsed.cell_lines[1];
        expect(line.raw).toBe('94,idemx2[5]');
        expect(line.sex_chromosomes).toBe('XXYY');
        expect(line.abnormalities[0].copy_count).toBe(2);
        expect(line.abnormalities[0].raw).toBe('+8');
      }
      if (example.id === 'C42') await expect(page.locator('.cell-lines')).toContainText('Composite group');
      if (example.id === 'C74') {
        await expect(page.locator('.cell-lines')).toContainText('93,sl2x2,+8[2]');
        await expect(page.locator('.cell-lines')).toContainText('References line 3 × 2');
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download JSON', exact: true }).click();
        const exported = JSON.parse(await readFile(await (await download).path(), 'utf8'));
        const line = exported.parsed.cell_lines[4];
        expect(line.reference.cell_line).toBe(3);
        expect(line.raw).toBe('93,sl2x2,+8[2]');
        expect(line.abnormalities.map((abn) => [abn.type, abn.chromosome, abn.copy_count]))
          .toEqual([['t', '9;22', 2], ['+', '8', null]]);
        expect(line.changes.map((abn) => abn.raw)).toEqual(['+8']);
      }
      if (example.id === 'C86' || example.id === 'C87') {
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Download JSON', exact: true }).click();
        const exported = JSON.parse(await readFile(await (await download).path(), 'utf8'));
        if (example.id === 'C86') {
          expect(exported.parsed.cell_lines[3].reference.cell_line).toBe(3);
          expect(exported.parsed.cell_lines[3].abnormalities.map((abn) => abn.raw)).toEqual(['+10', '+11', '+12']);
        } else {
          expect(exported.valid).toBe(false);
          expect(exported.parsed).toBeNull();
          expect(exported.errors.join('; ')).toContain('ambiguous among fully written lines');
        }
      }
    });
  }
  expect(errors).toEqual([]);
  expect(requests.filter((request) => request.body)).toEqual([]);
  for (const example of cases) {
    expect(requests.some((request) => decodeURIComponent(request.url).includes(example.input))).toBe(false);
  }
});
