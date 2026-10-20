import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { startPages } from '../helpers/pages.mjs';

let origin;
let cleanup;
test.beforeAll(async () => {
  ({ origin } = await startPages({ after(fn) { cleanup = fn; } }));
});
test.afterAll(async () => { await cleanup?.(); });

async function openWorksheet(page) {
  await page.goto(`${origin}/review`);
  await expect(page.locator('#svelte-announcer')).toBeAttached();
  await page.getByRole('button', { name: 'CNV evidence', exact: true }).click();
  return page.getByRole('region', { name: 'CNV evidence workspace', exact: true });
}

async function downloadWorksheet(page, workspace) {
  const downloaded = page.waitForEvent('download');
  await workspace.getByRole('button', { name: 'Export CNV worksheet JSON', exact: true }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe('cnv-evidence-worksheet.json');
  return JSON.parse(await readFile(await file.path(), 'utf8'));
}

test('CNV evidence remains local, exports a provisional snapshot and invalidates edited evidence', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const workspace = await openWorksheet(page);
  const requests = [];
  page.on('request', request => requests.push({ url: request.url(), body: request.postData() }));
  await workspace.getByLabel('CNV chromosome', { exact: true }).fill('1');
  await workspace.getByRole('combobox', { name: 'Genome assembly', exact: true }).selectOption('GRCh38');
  await workspace.getByLabel('Start coordinate', { exact: true }).fill('100000');
  await workspace.getByLabel('End coordinate', { exact: true }).fill('200000');
  await workspace.getByLabel('Assessed coding gene count', { exact: true }).fill('35');
  const entries = [['1A', '0'], ['3C', '0.90'], ['5G', '0.09']];
  for (const [index, [criterion, score]] of entries.entries()) {
    const number = index + 1;
    await workspace.getByRole('button', { name: 'Add evidence', exact: true }).click();
    await workspace.getByRole('combobox', { name: `Criterion ${number}`, exact: true }).selectOption(criterion);
    await workspace.getByLabel(`Points ${number}`, { exact: true }).fill(score);
    await workspace.getByLabel(`Evidence-unit ID ${number}`, { exact: true }).fill(`synthetic-observation-${number}`);
    await workspace.getByLabel(`Citation and source version ${number}`, { exact: true }).fill(`CNV_LOCAL_SYNTHETIC_SOURCE_${number}`);
    await workspace.getByLabel(`Evidence rationale ${number}`, { exact: true }).fill('Synthetic boundary evaluation only.');
  }
  for (let section = 1; section <= 5; section++) {
    await workspace.getByLabel(new RegExp(`^Section ${section}:`)).fill('Synthetic assessment; no omitted applicable category.');
    await workspace.getByLabel(`Section ${section} reviewed`, { exact: true }).check();
  }
  await workspace.getByLabel('This is a constitutional CNV', { exact: false }).check();
  await workspace.getByLabel('I reviewed the complete guideline', { exact: false }).check();
  await workspace.getByLabel('I checked for reused cases', { exact: false }).check();
  await workspace.getByLabel('CNV reviewer', { exact: true }).fill('Evaluation reviewer');
  await workspace.getByLabel('Assessment date', { exact: true }).fill('2026-10-19');
  await workspace.getByRole('button', { name: 'Calculate provisional score', exact: true }).click();
  await expect(workspace.getByRole('heading', { name: 'Provisional score: 0.99', exact: true })).toBeVisible();
  await expect(workspace.getByRole('region', { name: 'CNV worksheet result', exact: true })).toBeFocused();
  const complete = await downloadWorksheet(page, workspace);
  expect(complete.result.provisionalClassification).toBe('Pathogenic');
  expect(complete.result.score).toBe(0.99);
  expect(complete.authenticated).toBe(false);
  expect(complete.input.evidence[1].citation).toBe('CNV_LOCAL_SYNTHETIC_SOURCE_2');
  expect(complete.framework.correctionDoi).toBe('10.1038/s41436-021-01150-9');

  await workspace.getByLabel('Citation and source version 2', { exact: true }).fill('CNV_LOCAL_REVISED_SOURCE');
  await expect(workspace.getByRole('heading', { name: /^Provisional score:/ })).toHaveCount(0);
  for (let section = 1; section <= 5; section++) {
    await expect(workspace.getByLabel(`Section ${section} reviewed`, { exact: true })).not.toBeChecked();
  }
  await expect(workspace.getByLabel('I checked for reused cases', { exact: false })).not.toBeChecked();
  const draft = await downloadWorksheet(page, workspace);
  expect(draft.result.status).toBe('incomplete');
  expect(draft.result.score).toBeNull();
  expect(draft.result.provisionalClassification).toBeNull();
  expect(draft.input.evidence[1].citation).toBe('CNV_LOCAL_REVISED_SOURCE');
  expect(complete.input.evidence[1].citation).toBe('CNV_LOCAL_SYNTHETIC_SOURCE_2');
  expect(requests.filter(request => request.body)).toEqual([]);
  expect(requests.some(request => request.url.includes('CNV_LOCAL'))).toBe(false);
  expect(await page.evaluate(() => Object.values(localStorage).some(value => value.includes('CNV_LOCAL')))).toBe(false);
  expect(errors).toEqual([]);
});

test('mobile CNV draft shows required assessments without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const workspace = await openWorksheet(page);
  await workspace.getByRole('button', { name: 'Calculate provisional score', exact: true }).click();
  await expect(workspace.getByRole('heading', { name: 'Assessment incomplete — no score or category', exact: true })).toBeVisible();
  await workspace.getByRole('button', { name: 'Add evidence', exact: true }).click();
  await workspace.getByRole('combobox', { name: 'Criterion 1', exact: true }).selectOption('5H');
  await expect(workspace.getByText('Allowed points: 0 to 0.3.', { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
