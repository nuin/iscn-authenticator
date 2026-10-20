import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getChromosomeBands, mapBandToRange, validateKaryotypeNative } from '@iscn/core';
import { breakpointRanges, chromosomeGeometry } from '../src/lib/ideogram.ts';
import {
  reviewKaryotype,
  reviewBatch,
  batchCSV,
  spreadsheetCell,
} from '../src/lib/validation.ts';

test('centromeres retain the reference p/q junction for metacentric and acrocentric chromosomes', () => {
  for (const [chromosome, junction] of [['1', 123_400_000], ['5', 48_800_000], ['13', 17_700_000], ['21', 12_000_000], ['Y', 10_400_000]]) {
    const bands = getChromosomeBands(chromosome);
    const height = bands.at(-1).end / 248_956_422 * 132;
    const geometry = chromosomeGeometry(bands, 12, height);
    assert.equal(geometry.centromere.junction, junction * geometry.scale);
    assert.ok(geometry.centromere.start < geometry.centromere.junction);
    assert.ok(geometry.centromere.end > geometry.centromere.junction);
    assert.ok(geometry.centromere.start > 0 && geometry.centromere.end < height);
  }
});

test('missing centromere annotations do not fabricate a central constriction', () => {
  const bands = getChromosomeBands('5').filter((band) => band.stain !== 'acen');
  assert.equal(chromosomeGeometry(bands, 34, 264).centromere, null);
  assert.equal(chromosomeGeometry([], 34, 264), null);
});

test('chromosome overview retains repeated chromosome positions and both insertion donor breakpoints', () => {
  const translocation = validateKaryotypeNative('46,XX,t(1;1)(p36;q21)').parsed.abnormalities[0];
  assert.deepEqual(breakpointRanges(translocation, '1'), ['p36', 'q21'].map((band) => mapBandToRange('1', band)));
  const insertion = validateKaryotypeNative('46,XX,ins(1;2)(p36;q21q31)').parsed.abnormalities[0];
  assert.deepEqual(breakpointRanges(insertion, '1'), [mapBandToRange('1', 'p36')]);
  assert.deepEqual(breakpointRanges(insertion, '2'), ['q21', 'q31'].map((band) => mapBandToRange('2', band)));
  assert.deepEqual(breakpointRanges(insertion, '3'), []);
});

test('review labels distinguish implemented checks from partial coverage without changing the core result', () => {
  for (const [input, status] of [
    ['46,XX', 'Checks passed'],
    ['46,XX,del(5)(q13q33)', 'Checks passed'],
    ['46XX', 'Issues found'],
    ['46,XX,unrecognized', 'Review required'],
    ['46,XX,der(9)t(9;22)(q34;q11.2)', 'Review required'],
    ['45~48,XX', 'Review required'],
    ['47,XX,+21[5]/46,XX[10]', 'Checks passed'],
    ['46,XX.ish invalid assay text', 'Review required'],
    ['46,XX.arr', 'Review required'],
    ['nuc ish (D21S259x3)', 'Review required'],
    ['46,XX.cp[20]', 'Review required'],
    ['46,XX,+mar', 'Review required'],
    ['46,XX,inc', 'Review required'],
  ]) {
    const review = reviewKaryotype(input);
    assert.equal(review.status, status, input);
    assert.deepEqual(review.result, validateKaryotypeNative(input), input);
    assert.equal(review.coverage.length > 0, status === 'Review required', input);
  }
});

test('issues take precedence while incomplete coverage remains visible', () => {
  const review = reviewKaryotype('46,XX,+99,unsupported');
  assert.equal(review.status, 'Issues found');
  assert.ok(review.result.errors.length > 0);
  assert.ok(review.coverage.some((note) => note.code === 'unsupported'));
});

test('central core coverage reaches the browser for uncertainty, polyploid totals and finer subbands', () => {
  for (const input of ['69,XXX', '46,XX,?del(5)(p15)', '46,XX,del(5)(p15.31111)']) {
    assert.equal(reviewKaryotype(input).status, 'Review required', input);
    assert.ok(reviewKaryotype(input).coverage.length > 0, input);
  }
});

test('coverage includes unsupported abnormalities in later cell lines', () => {
  const review = reviewKaryotype('47,XX,+21[10]/46,XX,unknown[5]');
  assert.ok(review.coverage.some((note) => note.code === 'unsupported'));
});

test('mosaic review checks every line and identifies the failing line in exports', () => {
  const rows = reviewBatch('47,XX,+21[5]/46,XX[10]\n47,XX,+21[10]/47,XX,+99[5]').rows;
  assert.equal(rows[0].status, 'Checks passed');
  assert.deepEqual(rows[0].coverage, []);
  assert.equal(rows[1].status, 'Issues found');
  assert.match(batchCSV(rows), /Cell line 2: Invalid chromosome '99'/);
});

test('review notes remain specific to unresolved clone ordering and donor identity', () => {
  const clones = reviewKaryotype('47,XX,+8[5]/47,XX,+21[10]/46,XX[20]');
  assert.equal(clones.status, 'Review required');
  assert.ok(clones.coverage.some((note) => note.code === 'cell-line-order'));
  const transplant = reviewKaryotype('46,XX[5]//47,XY,+21[15]');
  assert.equal(transplant.result.valid, true);
  assert.ok(transplant.coverage.some((note) => note.code === 'donor'));
  assert.equal(reviewKaryotype('chi 46,XY[25]/46,XX[10]').status, 'Checks passed');
});

test('batch keeps malformed entries and their original source line numbers', () => {
  const batch = reviewBatch('46,XX\n \nnot a karyotype\r\n47,XY,+21\n');
  assert.equal(batch.error, null);
  assert.deepEqual(batch.rows.map(({ line, karyotype, status }) => ({ line, karyotype, status })), [
    { line: 1, karyotype: '46,XX', status: 'Checks passed' },
    { line: 3, karyotype: 'not a karyotype', status: 'Issues found' },
    { line: 4, karyotype: '47,XY,+21', status: 'Checks passed' },
  ]);
  assert.equal(batch.rows[1].result.parsed, null);
});

test('batch accepts 500 nonempty lines and rejects overflow without silently truncating', () => {
  assert.equal(reviewBatch(Array(500).fill('46,XX').join('\n')).rows.length, 500);
  const overflow = reviewBatch(Array(501).fill('46,XX').join('\n'));
  assert.equal(overflow.rows.length, 0);
  assert.match(overflow.error, /501/);
  assert.ok(reviewBatch(' \n\r\n').error);
});

test('spreadsheet export quotes every cell, doubles quotes, and neutralizes formula prefixes', () => {
  for (const value of ['=SUM(1,2)', '+1', '-1', '@SUM(A1)', '  =1', '\t=1', '\r=1']) {
    assert.equal(spreadsheetCell(value), `"'${value.replaceAll('"', '""')}"`);
  }
  assert.equal(spreadsheetCell('46,XX'), '"46,XX"');
  assert.equal(spreadsheetCell('a"b\nc'), '"a""b\nc"');
});

test('CSV preserves every batch row with status, core valid flag, errors and coverage', () => {
  const rows = reviewBatch('46,XX\n=2+3\n46,XX,unknown').rows;
  const csv = batchCSV(rows);
  assert.equal(csv.split('\r\n').length, 4);
  assert.match(csv, /"1","46,XX","Checks passed","true","",""/);
  assert.match(csv, /"2","'=2\+3","Issues found","false"/);
  assert.match(csv, /"3","46,XX,unknown","Review required","true"/);
  assert.match(csv, /not checked/);
});
