import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reviewReport } from '../src/lib/review/report.ts';
import { buildFish } from '../src/lib/review/fish.ts';
import { createFishRecord, createReviewRecord, reviewRecordCSV } from '../src/lib/review/records.ts';

const report = {
  notation: '47,XX,+21[5]/46,XX[15]', previousNotation: '', analyzedCells: '20',
  context: 'constitutional', conclusion: 'abnormality-detected', reportText: '',
};
const fish = {
  probes: [{ name: 'D21S259', signals: '3' }], countMode: 'mixed',
  observedNuclei: '10', totalNuclei: '200', cutoffPercent: '', cutoffOperator: '>=', protocol: '',
};
const signoff = { reviewer: 'Example reviewer', disposition: 'reviewed', rationale: 'Synthetic evaluation case checked.', acknowledgedLimits: true };

test('composite metaphases are labeled as aggregate groups in report counts', () => {
  const result = reviewReport({ ...report, context: 'neoplastic', notation: '45~47,XX,+8[cp12]/46,XX[8]' });
  assert.equal(result.totalCells, 20);
  assert.equal(result.lines[0].isComposite, true);
  assert.equal(result.lines[1].isComposite, false);
  assert.equal(result.lines[0].label, '45~47,XX,+8[cp12]');
  assert.equal(result.lines[0].percentage, 60);
  assert.ok(result.checks.some((check) => /do not establish.*co-occurrence/i.test(check.outcome)));
});

test('expanded clone arithmetic cannot feed a misleading literal comparison', () => {
  const expanded = '47,XX,+8[10]/94,idemx2[5]';
  for (const input of [
    { notation: expanded, previousNotation: '47,XX,+8[15]' },
    { notation: '47,XX,+8[15]', previousNotation: expanded },
    { notation: '46,XX,inv(3)(p21q26)[10]/46,idem,+3,-inv(3)[5]', previousNotation: '46,XX[15]' },
  ]) {
    const result = reviewReport({ ...report, ...input, context: 'neoplastic', analyzedCells: '15' });
    assert.equal(result.comparison, null);
    assert.ok(result.issues.some((issue) => issue.code === 'QC_COMPARISON_EXPANSION'));
  }
});

test('report checks declared totals and uses all cell lines as the percentage denominator', () => {
  const result = reviewReport(report);
  assert.equal(result.status, 'Checks passed');
  assert.equal(result.totalCells, 20);
  assert.deepEqual(result.lines.map(({ count, percentage }) => ({ count, percentage })), [
    { count: 5, percentage: 25 }, { count: 15, percentage: 75 },
  ]);
  const mismatch = reviewReport({ ...report, analyzedCells: '25' });
  assert.equal(mismatch.status, 'Issues found');
  assert.ok(mismatch.issues.some((issue) => issue.code === 'QC_CELL_TOTAL' && issue.severity === 'error'));
});

test('missing counts are not invented from the declared total', () => {
  const result = reviewReport({ ...report, notation: '46,XX', conclusion: 'no-abnormality' });
  assert.equal(result.totalCells, null);
  assert.equal(result.lines[0].count, null);
  assert.equal(result.lines[0].percentage, null);
  assert.ok(result.issues.some((issue) => issue.code === 'QC_COUNTS_UNAVAILABLE'));
});

test('structured conclusions conflict with numerical, structural and sex-complement findings', () => {
  for (const notation of ['47,XX,+21', '45,X', '46,XX,del(5)(q13q33)']) {
    const result = reviewReport({ ...report, notation, analyzedCells: '', conclusion: 'no-abnormality' });
    assert.ok(result.issues.some((issue) => issue.code === 'QC_CONCLUSION' && issue.severity === 'error'), notation);
  }
  const normal = reviewReport({ ...report, notation: '46,XY', analyzedCells: '' });
  assert.ok(normal.issues.some((issue) => issue.code === 'QC_CONCLUSION' && issue.severity === 'error'));
});

test('uninterpreted assays and unknown notation cannot certify a normal conclusion', () => {
  for (const notation of ['nuc ish (D21S259x3)[10/200]', '46,XX,unknown']) {
    const result = reviewReport({ ...report, notation, analyzedCells: '', conclusion: 'no-abnormality' });
    assert.equal(result.status, 'Review required');
    assert.ok(result.issues.some((issue) => issue.code === 'QC_CONCLUSION_UNASSESSED'));
  }
});

test('constitutional abnormal cell-line size order is checked within recipient/donor groups', () => {
  const wrongOrder = reviewReport({ ...report, notation: '47,XX,+8[5]/47,XX,+21[10]/46,XX[5]' });
  assert.ok(wrongOrder.issues.some((issue) => issue.code === 'QC_CONSTITUTIONAL_ORDER'));
  const neoplastic = reviewReport({ ...report, notation: '47,XX,+8[5]/47,XX,+21[10]/46,XX[5]', context: 'neoplastic' });
  assert.ok(!neoplastic.issues.some((issue) => issue.code === 'QC_CONSTITUTIONAL_ORDER'));
});

test('previous/current comparison preserves multiplicity and never equates clone membership', () => {
  const result = reviewReport({ ...report, notation: '49,XX,+8,+8,+21', previousNotation: '47,XX,+8', analyzedCells: '' });
  assert.deepEqual(result.comparison.added, ['+8', '+21']);
  assert.deepEqual(result.comparison.removed, []);
  assert.deepEqual(result.comparison.retained, ['+8']);
  assert.ok(result.checks.some((check) => /clone identity/i.test(check.outcome)));
});

test('invalid prior notation is retained as an issue instead of producing a misleading comparison', () => {
  const result = reviewReport({ ...report, previousNotation: 'not notation' });
  assert.equal(result.comparison, null);
  assert.ok(result.issues.some((issue) => issue.code === 'QC_PREVIOUS_NOTATION'));
});

test('invalid cell totals and unrecognized selections are rejected', () => {
  for (const analyzedCells of ['-1', '0', '2.5', '1e2', 'NaN', '9007199254740992']) {
    assert.ok(reviewReport({ ...report, analyzedCells }).issues.some((issue) => issue.code === 'QC_DECLARED_TOTAL'), analyzedCells);
  }
  assert.ok(reviewReport({ ...report, context: 'guess' }).issues.some((issue) => issue.code === 'QC_INPUT'));
  assert.ok(reviewReport({ ...report, conclusion: 'guess' }).issues.some((issue) => issue.code === 'QC_INPUT'));
});

test('FISH generates shared and differing signal counts using the appropriate parenthesis placement', () => {
  assert.equal(buildFish(fish).notation, 'nuc ish (D21S259)x3[10/200]');
  assert.equal(buildFish({ ...fish, probes: [{ name: 'P1', signals: '2' }, { name: 'P2', signals: '2' }] }).notation, 'nuc ish (P1,P2)x2[10/200]');
  assert.equal(buildFish({ ...fish, probes: [{ name: 'P1', signals: '0' }, { name: 'P2', signals: '2' }] }).notation, 'nuc ish (P1x0,P2x2)[10/200]');
  assert.equal(buildFish({ ...fish, observedNuclei: '200', countMode: 'all-observed' }).notation, 'nuc ish (D21S259)x3[200]');
  assert.equal(buildFish({ ...fish, observedNuclei: '200', countMode: 'constitutional-nonmosaic' }).notation, 'nuc ish (D21S259)x3');
});

test('FISH evaluates exact cutoff equality using the laboratory operator and has no default cutoff', () => {
  assert.equal(buildFish(fish).threshold, 'not-assessed');
  const threshold = { ...fish, cutoffPercent: '5', protocol: 'Synthetic protocol v1' };
  assert.equal(buildFish(threshold).percentage, 5);
  assert.equal(buildFish(threshold).threshold, 'meets');
  assert.equal(buildFish({ ...threshold, cutoffOperator: '>' }).threshold, 'does-not-meet');
  assert.equal(buildFish({ ...threshold, observedNuclei: '11' }).threshold, 'meets');
  assert.equal(buildFish({ ...threshold, observedNuclei: '9' }).threshold, 'does-not-meet');
  assert.equal(buildFish({ ...threshold, protocol: '' }).notation, null);
  assert.equal(buildFish({ ...threshold, totalNuclei: '100', observedNuclei: '29', cutoffPercent: '29' }).threshold, 'meets');
  assert.equal(buildFish({ ...threshold, totalNuclei: '50', observedNuclei: '7', cutoffPercent: '14', cutoffOperator: '>' }).threshold, 'does-not-meet');
});

test('FISH rejects impossible counts, duplicate probes and unhandled syntax without emitting notation', () => {
  for (const change of [
    { observedNuclei: '0' }, { observedNuclei: '201' }, { observedNuclei: '1.5' },
    { totalNuclei: '0' }, { totalNuclei: '1e3' }, { totalNuclei: '9007199254740992' },
    { countMode: 'all-observed' }, { countMode: 'constitutional-nonmosaic' },
    { observedNuclei: '200' }, { cutoffPercent: '101' }, { cutoffPercent: '-1' },
    { cutoffPercent: '5', cutoffOperator: '=' }, { probes: [] },
    { probes: [{ name: 'P1)[20],(P2', signals: '2' }] },
    { probes: [{ name: 'P1', signals: '2' }, { name: 'P1', signals: '3' }] },
    { probes: [{ name: 'P1', signals: '-1' }] }, { probes: [{ name: 'P1', signals: 'NaN' }] },
  ]) {
    const result = buildFish({ ...fish, ...change });
    assert.equal(result.notation, null, JSON.stringify(change));
    assert.ok(result.issues.some((issue) => issue.severity === 'error'));
  }
});

test('review records snapshot the exact reviewed input and reject stale results', () => {
  const input = { ...report };
  const result = reviewReport(input);
  const record = createReviewRecord(input, result, signoff, '2026-10-19T20:00:00.000Z');
  assert.equal(record.schema, 'iscn.review-record.v1');
  assert.equal(record.recordType, 'local-self-attested-review');
  assert.equal(record.createdAt, '2026-10-19T20:00:00.000Z');
  assert.ok(record.references.length > 0);
  input.notation = '46,XY';
  assert.equal(record.input.notation, '47,XX,+21[5]/46,XX[15]');
  assert.throws(() => createReviewRecord(input, result, signoff), /changed|stale/i);
  assert.throws(() => createReviewRecord({ ...report, reportText: 'Changed narrative' }, result, signoff), /changed|stale/i);
});

test('FISH worksheet exports include the exact threshold, protocol and raw counts', () => {
  const input = { ...fish, cutoffPercent: '5', protocol: 'Synthetic protocol v1' };
  const result = buildFish(input);
  const record = createFishRecord(input, result, '2026-10-19T20:00:00.000Z');
  assert.equal(record.schema, 'iscn.fish-worksheet.v1');
  assert.equal(record.input.cutoffPercent, '5');
  assert.equal(record.input.protocol, 'Synthetic protocol v1');
  assert.equal(record.review.threshold, 'meets');
  assert.ok(record.references.length > 0);
  assert.throws(() => createFishRecord({ ...input, observedNuclei: '11' }, result), /changed|stale/i);
  assert.throws(() => createFishRecord({ ...input, protocol: 'Changed protocol' }, result), /changed|stale/i);
});

test('reviewed disposition requires valid checks and explicit acknowledgment; follow-up preserves errors', () => {
  const invalid = { ...report, analyzedCells: '21' };
  const review = reviewReport(invalid);
  assert.throws(() => createReviewRecord(invalid, review, signoff), /follow-up|issues/i);
  assert.equal(createReviewRecord(invalid, review, { ...signoff, disposition: 'follow-up' }).review.status, 'Issues found');
  for (const change of [{ reviewer: '' }, { rationale: '' }, { acknowledgedLimits: false }, { disposition: 'approved' }]) {
    assert.throws(() => createReviewRecord(report, reviewReport(report), { ...signoff, ...change }));
  }
  assert.throws(() => createReviewRecord(report, reviewReport(report), signoff, 'not a date'));
});

test('record CSV quotes free text and neutralizes reviewer and narrative spreadsheet formulas', () => {
  const input = { ...report, reportText: '=1+1\n"quoted"' };
  const record = createReviewRecord(input, reviewReport(input), { ...signoff, reviewer: '@SUM(A1)' }, '2026-10-19T20:00:00.000Z');
  const csv = reviewRecordCSV(record);
  assert.ok(csv.includes('"\'@SUM(A1)"'));
  assert.ok(csv.includes('"\'=1+1\n""quoted"""'));
  assert.ok(csv.includes('47,XX,+21[5]/46,XX[15]'));
});
