import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { startPages } from '../helpers/pages.mjs';

let origin;
let emailCode;
let cleanup;
test.beforeAll(async () => {
  ({ origin, emailCode } = await startPages({ after(fn) { cleanup = fn; } }));
});
test.afterAll(async () => { await cleanup?.(); });

async function open(page, path) {
  await page.goto(`${origin}${path}`);
  await expect(page.locator('#svelte-announcer')).toBeAttached();
}

test('browser review distinguishes coverage and keeps entered notation local', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page, '/validate?karyotype=46%2CXX');
  const input = page.getByLabel('ISCN notation', { exact: true });
  await expect(input).toHaveValue('46,XX');
  const requests = [];
  page.on('request', (request) => requests.push({ url: request.url(), body: request.postData() }));
  await input.fill('47,XY,+21');
  await page.getByRole('button', { name: 'Check karyotype' }).click();
  await expect(page.getByRole('heading', { name: 'Checks passed', exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON', exact: true }).click();
  const download = await downloadEvent;
  const raw = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(raw.valid).toBe(true);
  expect(raw.parsed.chromosome_count).toBe(47);
  expect(raw).not.toHaveProperty('coverage');
  await input.fill('not-a-karyotype');
  await page.getByRole('button', { name: 'Check karyotype' }).click();
  await expect(page.getByRole('heading', { name: 'Issues found', exact: true })).toBeVisible();
  await input.fill('46,XX,unrecognized');
  await page.getByRole('button', { name: 'Check karyotype' }).click();
  await expect(page.getByRole('heading', { name: 'Review required', exact: true })).toBeVisible();
  await expect(page.getByLabel('Coverage limitations')).toContainText('not checked by a dedicated rule');
  expect(requests.filter((request) => request.body)).toEqual([]);
  expect(requests.some((request) => /explain\/miss|unrecognized|not-a-karyotype|47%2CXY/i.test(request.url))).toBe(false);
  expect(errors).toEqual([]);
});

test('mobile navigation and guide search remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page, '/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const navigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await navigation.getByRole('link', { name: 'Documentation', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/docs`);
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  const search = page.getByRole('searchbox', { name: 'Search guides' });
  await search.fill('zzzzzz');
  await expect(page.getByText('No guides match.', { exact: false })).toBeVisible();
  await search.fill('mosaic');
  const guides = page.getByRole('navigation', { name: 'Documentation guides' });
  await guides.getByRole('link', { name: 'Coverage and limitations' }).click();
  await expect(page).toHaveURL(`${origin}/docs/coverage`);
  await expect(page.getByRole('heading', { name: 'Coverage and limitations', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('mobile validation moves keyboard focus to the completed result', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await open(page, '/validate');
  await page.getByLabel('ISCN notation', { exact: true }).fill('46,XX,unknown');
  await page.getByRole('button', { name: 'Check karyotype' }).click();
  const output = page.getByRole('region', { name: 'Validation output' });
  await expect(output).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Review required', exact: true })).toBeInViewport();
});

test('the chromosome preview has one visible constriction at the p/q junction', async ({ page }) => {
  await open(page, '/');
  const crossSection = await page.locator('.chromosome-view clipPath').evaluate((clip) => {
    const shape = clip.firstElementChild;
    const box = shape.getBBox();
    const junction = box.y + box.height * 48_800_000 / 181_538_259;
    return [0.05, 0.5, 0.95].map((fraction) =>
      shape.isPointInFill(new DOMPoint(box.x + box.width * fraction, junction)));
  });
  expect(crossSection).toEqual([false, true, false]);
  await expect(page.getByText('Centromere', { exact: true })).toBeVisible();
});

test('the mosaic example lists the abnormal cell line before the normal cell line', async ({ page }) => {
  await open(page, '/validate');
  await page.getByRole('button', { name: /Multiple cell lines/ }).click();
  await expect(page.getByLabel('ISCN notation', { exact: true })).toHaveValue('47,XX,+21[5]/46,XX[10]');
  await page.getByRole('button', { name: 'Check karyotype' }).click();
  await expect(page.getByRole('heading', { name: 'Checks passed', exact: true })).toBeVisible();
  await expect(page.getByText('Coverage needs attention', { exact: true })).toHaveCount(0);
  await page.getByLabel('ISCN notation', { exact: true }).fill('47,XX,+21[5]/47,XX,+99[10]');
  await page.getByRole('button', { name: 'Check karyotype' }).click();
  await expect(page.getByRole('heading', { name: 'Issues found', exact: true })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: /Cell line 2: Invalid chromosome '99'/ })).toBeVisible();
  await page.getByLabel('ISCN notation', { exact: true }).fill('46,XX[10]/47,XX,+21[5]');
  await page.getByRole('button', { name: 'Check karyotype' }).click();
  await expect(page.getByRole('heading', { name: 'Issues found', exact: true })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: /normal cell line must be listed last/ })).toBeVisible();
});

test('example library opens a complete structural example', async ({ page }) => {
  await open(page, '/explain');
  await page.getByRole('searchbox', { name: 'Find an example' }).fill('translocation');
  await page.getByRole('link', { name: /A translocation between 9 and 22/ }).click();
  await page.getByRole('link', { name: 'Open in the validator' }).click();
  await expect(page.getByLabel('ISCN notation', { exact: true })).toHaveValue('46,XX,t(9;22)(q34;q11.2)');
  await page.getByRole('button', { name: 'Check karyotype' }).click();
  await expect(page.getByRole('heading', { name: 'Checks passed', exact: true })).toBeVisible();
});

test('lab evaluation guide exposes a downloadable starter kit', async ({ page }) => {
  await open(page, '/docs');
  await page.getByRole('link', { name: 'Use the starter inputs and review worksheet.' }).click();
  await expect(page.getByRole('heading', { name: 'Evaluate the workspace for your lab', exact: true })).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download starter inputs (.txt)' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('iscn-evaluation-inputs.txt');
  const inputs = (await readFile(await download.path(), 'utf8')).trimEnd().split('\n');
  expect(inputs).toHaveLength(10);
  expect(inputs).toContain('47,XX,+21[10]/47,XX,+99[5]');
});

test('verified email access and batch exports preserve the review', async ({ page }) => {
  await open(page, '/signup');
  await page.getByLabel('Email').fill('lab-workflow@example.test');
  await page.getByRole('button', { name: 'Send email code', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await page.getByLabel('Email code', { exact: true }).fill(await emailCode('lab-workflow@example.test'));
  await page.getByRole('button', { name: 'Verify email and continue' }).click();
  await expect(page).toHaveURL(`${origin}/dashboard`);
  await expect(page.locator('header.site-header').getByRole('link', { name: 'Workspace', exact: true })).toBeVisible();
  await expect(page.locator('header.site-header').getByRole('link', { name: 'Log in', exact: true })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Workspace navigation' }).getByRole('link', { name: 'Batch review' }).click();
  await page.getByRole('button', { name: 'Check batch' }).click();
  await expect(page.getByRole('alert')).toContainText('Enter at least one karyotype');
  await page.getByRole('button', { name: 'Load example batch' }).click();
  await expect(page.getByLabel('ISCN notation, one entry per line')).toHaveValue(/47,XX,\+21\[5\]\/46,XX\[10\]/);
  await page.getByRole('button', { name: 'Check batch' }).click();
  await expect(page.getByRole('heading', { name: '4 entries checked' })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  const details = await page.locator('td.row-details').nth(2).boundingBox();
  expect(details.x).toBeGreaterThanOrEqual(0);
  expect(details.x + details.width).toBeLessThanOrEqual(375);
  await expect(page.getByRole('heading', { name: '4 entries checked' })).toBeFocused();
  await page.getByLabel('Show', { exact: true }).selectOption('Issues found');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON', exact: true }).click();
  const download = await downloadEvent;
  const rows = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(rows).toHaveLength(4);
  expect(rows[3].status).toBe('Checks passed');
  expect(rows[3].coverage).toEqual([]);
  await page.getByLabel('ISCN notation, one entry per line').fill(Array(501).fill('46,XX').join('\n'));
  await page.getByRole('button', { name: 'Check batch' }).click();
  await expect(page.getByRole('alert')).toContainText('501 entries');
  await expect(page.locator('tbody tr')).toHaveCount(0);
});
