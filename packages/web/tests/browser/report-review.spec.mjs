import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { startPages } from '../helpers/pages.mjs';

let origin;
let cleanup;
test.beforeAll(async () => {
  ({ origin } = await startPages({ after(fn) { cleanup = fn; } }));
});
test.afterAll(async () => { await cleanup?.(); });

async function openReview(page) {
  await page.goto(`${origin}/review`);
  await expect(page.locator('#svelte-announcer')).toBeAttached();
  await expect(page.getByRole('heading', { name: 'Laboratory report review', exact: true })).toBeVisible();
}

async function signReview(page) {
  await page.getByLabel('Reviewer name').fill('Synthetic reviewer');
  await page.getByLabel('Disposition', { exact: true }).selectOption('reviewed');
  await page.getByLabel('Review rationale').fill('Synthetic counts checked against the supplied notation.');
  await page.getByLabel('I acknowledge the scope and limitations').check();
}

async function capture(page, testInfo, filename) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath(filename), fullPage: true });
}

test('report review exposes count mismatch and exports the checked source locally', async ({ page }, testInfo) => {
  await openReview(page);
  const requests = [];
  const errors = [];
  page.on('request', (request) => requests.push({ url: request.url(), body: request.postData() }));
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('button', { name: 'Use synthetic example' }).click();
  await page.getByLabel('Declared analyzed cells').fill('21');
  await page.getByRole('button', { name: 'Review report', exact: true }).focus();
  await page.keyboard.press('Enter');
  const output = page.getByRole('region', { name: 'Report review result' });
  await expect(output.getByRole('heading', { name: 'Issues found', exact: true })).toBeVisible();
  await expect(output).toBeFocused();
  await expect(output).toContainText('20');
  await expect(output).toContainText('21');
  await page.getByLabel('Declared analyzed cells').fill('20');
  await page.getByRole('button', { name: 'Review report', exact: true }).click();
  await expect(output.getByRole('table', { name: 'Cell line counts' })).toContainText('25%');
  await expect(output.getByRole('table', { name: 'Cell line counts' })).toContainText('75%');
  await expect(output.getByRole('region', { name: 'Added findings' })).toContainText('+21');
  await expect(page.getByRole('button', { name: 'Download review JSON' })).toBeDisabled();
  await signReview(page);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download review JSON' }).click();
  const download = await downloadEvent;
  const record = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(record.schema).toBe('iscn.review-record.v1');
  expect(record.input.notation).toBe('47,XX,+21[5]/46,XX[15]');
  expect(record.input.analyzedCells).toBe('20');
  expect(record.review.totalCells).toBe(20);
  expect(record.signoff.reviewer).toBe('Synthetic reviewer');
  expect(record.signoff.acknowledgedLimits).toBe(true);
  expect(requests.filter((request) => request.body)).toEqual([]);
  expect(requests.some((request) => /47%2CXX|47,XX|Synthetic|%2B21/i.test(request.url))).toBe(false);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(errors).toEqual([]);
  await capture(page, testInfo, 'report-review-desktop.png');
});

test('every report field edit removes the previous result and signoff', async ({ page }) => {
  await openReview(page);
  const edits = [
    () => page.getByLabel('Current ISCN notation').fill('46,XX[20]'),
    () => page.getByLabel('Previous ISCN notation').fill('46,XX[19]'),
    () => page.getByLabel('Declared analyzed cells').fill('19'),
    () => page.getByLabel('Specimen context').selectOption('neoplastic'),
    () => page.getByLabel('Structured conclusion').selectOption('no-abnormality'),
    () => page.getByLabel('Report narrative').fill('Revised synthetic text'),
  ];
  for (const edit of edits) {
    await page.getByRole('button', { name: 'Use synthetic example' }).click();
    await page.getByRole('button', { name: 'Review report', exact: true }).click();
    await signReview(page);
    await expect(page.getByRole('button', { name: 'Download review JSON' })).toBeEnabled();
    await edit();
    await expect(page.getByRole('button', { name: 'Download review JSON' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Ready for review', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Review report', exact: true }).click();
    await expect(page.getByLabel('Reviewer name')).toHaveValue('');
    await expect(page.getByLabel('I acknowledge the scope and limitations')).not.toBeChecked();
  }
});

test('FISH respects the selected threshold boundary and transfers notation explicitly', async ({ page }, testInfo) => {
  await openReview(page);
  const requests = [];
  page.on('request', (request) => requests.push({ url: request.url(), body: request.postData() }));
  await page.getByRole('button', { name: 'FISH builder', exact: true }).click();
  await page.getByLabel('Probe name 1').fill('D21S259');
  await page.getByLabel('Signal count 1').fill('3');
  await page.getByLabel('Observed nuclei').fill('10');
  await page.getByLabel('Total nuclei').fill('100');
  await page.getByLabel('Laboratory cutoff (%)').fill('10');
  await page.getByLabel('Cutoff operator').selectOption('>');
  await page.getByLabel('Laboratory protocol or reference').fill('Synthetic protocol v1');
  await page.getByRole('button', { name: 'Build FISH notation' }).click();
  await expect(page.getByRole('status', { name: 'FISH threshold result' })).toHaveText('Does not meet the entered threshold');
  await page.getByLabel('Cutoff operator').selectOption('>=');
  await expect(page.getByRole('button', { name: 'Use in report review' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Build FISH notation' }).click();
  await expect(page.getByRole('status', { name: 'FISH threshold result' })).toHaveText('Meets the entered threshold');
  await expect(page.getByLabel('Generated FISH notation')).toContainText('nuc ish (D21S259)x3[10/100]');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download FISH worksheet JSON' }).click();
  const download = await downloadEvent;
  const worksheet = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(worksheet.schema).toBe('iscn.fish-worksheet.v1');
  expect(worksheet.input.protocol).toBe('Synthetic protocol v1');
  expect(worksheet.input.cutoffOperator).toBe('>=');
  expect(worksheet.review.threshold).toBe('meets');
  await capture(page, testInfo, 'fish-builder-desktop.png');
  await page.getByRole('button', { name: 'Use in report review' }).click();
  await expect(page.getByLabel('Current ISCN notation')).toHaveValue('nuc ish (D21S259)x3[10/100]');
  await expect(page.getByRole('heading', { name: 'Ready for review', exact: true })).toBeVisible();
  expect(requests.filter((request) => request.body || /D21S259|Synthetic/i.test(request.url))).toEqual([]);
});

test('mobile report review supports navigation and CSV export without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${origin}/validate`);
  await expect(page.locator('#svelte-announcer')).toBeAttached();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Report review' }).click();
  await expect(page).toHaveURL(`${origin}/review`);
  await page.getByRole('button', { name: 'Use synthetic example' }).click();
  await page.getByRole('button', { name: 'Review report', exact: true }).click();
  await signReview(page);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download review CSV' }).click();
  const download = await downloadEvent;
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv).toContain('47,XX,+21[5]/46,XX[15]');
  expect(csv).toContain('Synthetic reviewer');
  await capture(page, testInfo, 'report-review-mobile.png');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'FISH builder', exact: true }).click();
  await expect(page.getByLabel('Probe name 1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'CNV evidence', exact: true }).click();
  await expect(page.getByLabel('CNV chromosome')).toBeVisible();
});

test('side documentation keeps the entered report and result available', async ({ page }, testInfo) => {
  await openReview(page);
  await page.getByRole('button', { name: 'Use synthetic example' }).click();
  await page.getByRole('button', { name: 'Review report', exact: true }).click();
  await page.getByRole('button', { name: 'Show documentation', exact: true }).click();
  const guide = page.getByRole('complementary', { name: 'Workspace documentation' });
  await expect(guide).toBeVisible();
  await guide.getByLabel('Documentation guide').selectOption('fish-builder');
  await guide.getByRole('button', { name: 'Read guide content', exact: true }).click();
  await expect(guide.getByRole('region', { name: 'Construct a FISH expression content', exact: true })).toBeFocused();
  await expect(guide.getByRole('heading', { name: 'Choose the count format', exact: true })).toBeVisible();
  await expect(guide.getByRole('link', { name: 'Open full guide (opens a new tab)', exact: true })).toHaveAttribute('target', '_blank');
  await expect(page.getByLabel('Current ISCN notation')).toHaveValue('47,XX,+21[5]/46,XX[15]');
  await expect(page.getByRole('button', { name: 'Download review JSON' })).toBeVisible();
  await capture(page, testInfo, 'report-documentation-desktop.png');
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await capture(page, testInfo, 'report-documentation-mobile.png');
  await page.getByRole('button', { name: 'Hide documentation', exact: true }).click();
  await expect(guide).toHaveCount(0);
  await expect(page.getByLabel('Current ISCN notation')).toHaveValue('47,XX,+21[5]/46,XX[15]');
  for (const width of [1280, 1060, 1024, 981, 980, 850]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
