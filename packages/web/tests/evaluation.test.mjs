import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluationCases, evaluationInputs, evaluationWorksheet } from '../src/lib/evaluation.ts';
import { reviewKaryotype } from '../src/lib/validation.ts';

test('published evaluation expectations match current checks, including known incomplete coverage', () => {
  assert.equal(evaluationCases.length, 10);
  assert.equal(new Set(evaluationCases.map(entry => entry.id)).size, 10);
  for (const entry of evaluationCases) {
    const review = reviewKaryotype(entry.notation);
    assert.equal(review.status, entry.status, entry.id);
    assert.equal(review.result.valid, entry.valid, entry.id);
  }
  assert.equal(reviewKaryotype('46,Y').status, 'Issues found');
  assert.equal(reviewKaryotype('46,XX[10]/46,Y[5]').status, 'Review required');
});

test('starter downloads preserve input order and leave observation fields blank', () => {
  assert.deepEqual(evaluationInputs().trimEnd().split('\n'), evaluationCases.map(entry => entry.notation));
  const rows = evaluationWorksheet().trimEnd().split('\r\n');
  assert.equal(rows.length, 11);
  assert.match(rows[0], /"Observed UI status","Observed core valid","Reviewer notes"$/);
  assert.match(rows[1], /^"E01","46,XX","Checks passed","true","","",""$/);
  assert.match(rows[8], /^"E08","46,XX\[10\]\/46,Y\[5\]","Review required","true","","",""$/);
});
