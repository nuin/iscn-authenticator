import assert from 'node:assert/strict';
import test from 'node:test';
import { assessCnv, createCnvRecord } from '../src/lib/review/cnv.ts';

function evidence(criterion, score, evidenceId = criterion) {
  return { criterion, score, evidenceId, citation: 'Synthetic evaluation reference', rationale: 'Synthetic reviewer assessment.' };
}

function worksheet(entries = []) {
  return {
    chromosome: '1', start: '100000', end: '200000', assembly: 'GRCh38', direction: 'loss',
    geneCount: '0', reviewer: 'Evaluation reviewer', assessmentDate: '2026-10-19',
    sectionReviews: [1, 2, 3, 4, 5].map(section => ({ section, reviewed: true, note: 'Reviewed synthetic sources; no additional applicable evidence.' })),
    constitutionalConfirmed: true, supportedOnly: true, independenceConfirmed: true, populationCaveatsReviewed: true,
    conflictRationale: '', patientInterpretation: '',
    evidence: [evidence('1A', '0'), evidence('3A', '0'), evidence('5F', '0'), ...entries]
  };
}

function issue(input, code) {
  const result = assessCnv(input);
  assert.equal(result.score, null);
  assert.equal(result.provisionalClassification, null);
  assert.ok(result.issues.some(entry => entry.code === code), JSON.stringify(result));
}

test('exact classification boundaries use hundredth-points without rounding across thresholds', () => {
  for (const [points, expected] of [
    ['-1', 'Benign'], ['-0.99', 'Benign'], ['-0.98', 'Likely benign'], ['-0.90', 'Likely benign'], ['-0.89', 'Uncertain significance']
  ]) {
    const result = assessCnv(worksheet([evidence('4O', points)]));
    assert.equal(result.provisionalClassification, expected, points);
  }
  for (const [extra, expected, total] of [
    ['0', 'Likely pathogenic', 0.90], ['0.08', 'Likely pathogenic', 0.98], ['0.09', 'Pathogenic', 0.99], ['0.10', 'Pathogenic', 1]
  ]) {
    const input = worksheet();
    input.geneCount = '35';
    input.evidence = [evidence('1A', '0'), evidence('3C', '0.90'), evidence('5G', extra)];
    const result = assessCnv(input);
    assert.equal(result.provisionalClassification, expected, extra);
    assert.equal(result.score, total);
  }
});

test('zero after an explicit completed assessment is provisional, and absent evidence is incomplete', () => {
  const result = assessCnv(worksheet());
  assert.equal(result.status, 'provisional');
  assert.equal(result.score, 0);
  assert.equal(result.provisionalClassification, 'Uncertain significance');
  issue({ ...worksheet(), evidence: [] }, 'required-category');
  issue({ ...worksheet(), sectionReviews: [] }, 'section-review');
  issue({ ...worksheet(), supportedOnly: false }, 'unsupported-evidence');
  issue({ ...worksheet(), constitutionalConfirmed: false }, 'scope');
  issue({ ...worksheet(), independenceConfirmed: false }, 'independence');
});

test('gain and loss gene-number bands differ at 25, 35, and 50 genes', () => {
  for (const [direction, count, category, score] of [
    ['loss', '24', '3A', '0'], ['loss', '25', '3B', '0.45'], ['loss', '34', '3B', '0.45'], ['loss', '35', '3C', '0.90'],
    ['gain', '34', '3A', '0'], ['gain', '35', '3B', '0.45'], ['gain', '49', '3B', '0.45'], ['gain', '50', '3C', '0.90']
  ]) {
    const input = worksheet();
    Object.assign(input, { direction, geneCount: count });
    input.evidence[1] = evidence(category, score);
    assert.equal(assessCnv(input).score, Number(score), `${direction}: ${count}`);
  }
  issue({ ...worksheet(), geneCount: '25' }, 'gene-count-category');
});

test('gain haploinsufficiency does not receive triplosensitivity points', () => {
  const input = { ...worksheet([evidence('2H', '0')]), direction: 'gain', geneCount: '1' };
  assert.equal(assessCnv(input).score, 0);
  input.evidence.at(-1).score = '1';
  issue(input, 'score-range');
  issue(worksheet([evidence('2C', '-1')]), 'unsupported-category');
});

test('exclusive categories, repeated categories, and reused evidence cannot increase the score', () => {
  issue(worksheet([evidence('1B', '-0.60')]), 'exclusive-category');
  issue(worksheet([evidence('4O', '-0.40'), evidence('4O', '-0.60', 'another cohort')]), 'duplicate-category');
  const input = worksheet([evidence('2A', '1', 'same source unit')]);
  input.geneCount = '35';
  input.evidence[1] = evidence('3C', '0.90', ' SAME SOURCE UNIT ');
  issue(input, 'duplicate-evidence');
  issue(worksheet([evidence('2A', '1'), evidence('2F', '-1')]), 'exclusive-category');
});

test('opposing evidence requires reconciliation and section 4 cannot duplicate established loss evidence', () => {
  const input = worksheet([evidence('4O', '-1')]);
  input.geneCount = '25';
  input.evidence[1] = evidence('3B', '0.45');
  issue(input, 'conflicting-evidence');
  input.conflictRationale = 'Independent evidence assessed; residual uncertainty remains.';
  assert.equal(assessCnv(input).score, -0.55);
  input.evidence.push(evidence('2A', '1'));
  issue(input, 'section-routing');
});

test('population scoring requires review of carrier status, matching dosage and dataset limitations', () => {
  issue({ ...worksheet([evidence('4O', '-1')]), populationCaveatsReviewed: false }, 'population-caveats');
});

test('the upper uncertain boundary and variable 5H range remain distinct', () => {
  const input = worksheet([evidence('4O', '-0.01')]);
  input.geneCount = '35';
  input.evidence[1] = evidence('3C', '0.90');
  input.conflictRationale = 'Synthetic independent opposing observations.';
  assert.equal(assessCnv(input).provisionalClassification, 'Uncertain significance');
  for (const score of ['0', '0.15', '0.30']) {
    input.evidence = [evidence('1A', '0'), evidence('3C', '0.90'), evidence('5H', score)];
    assert.equal(assessCnv(input).status, 'provisional');
  }
  input.evidence.at(-1).score = '0.31';
  issue(input, 'score-range');
});

test('score validation rejects blanks, nonfinite values, extra precision, and out-of-range points', () => {
  for (const score of ['', ' ', 'NaN', 'Infinity', '-1.01', '0.1', '-0.899', '1e-1']) {
    issue(worksheet([evidence('4O', score)]), 'score-range');
  }
  issue(worksheet([evidence('2A', '0.99')]), 'score-range');
});

test('identity, provenance, assessment date, and review notes are required', () => {
  for (const change of [
    { start: '' }, { start: '0' }, { start: '1.5' }, { start: '9007199254740992' },
    { end: '10' }, { chromosome: '23' }, { assembly: 'hg38' }, { direction: '' }, { geneCount: '-1' }
  ]) issue({ ...worksheet(), ...change }, 'identity');
  for (const assessmentDate of ['', '2026-02-30', 'not a date']) issue({ ...worksheet(), assessmentDate }, 'assessment-date');
  issue({ ...worksheet(), reviewer: ' ' }, 'reviewer');
  for (const field of ['citation', 'rationale', 'evidenceId']) {
    const input = worksheet();
    input.evidence[0][field] = ' ';
    issue(input, 'evidence-provenance');
  }
  const input = worksheet();
  input.sectionReviews[2].note = '';
  issue(input, 'section-review');
});

test('noncoding content cannot coexist with protein-coding gene counts', () => {
  const input = worksheet();
  input.evidence[0] = evidence('1B', '-0.60');
  input.geneCount = '1';
  issue(input, 'content-conflict');
});

test('export snapshots source inputs and freshly assessed results without implying authentication', () => {
  const input = worksheet([evidence('2A', '1')]);
  const record = createCnvRecord(input, '2026-10-19T12:00:00.000Z');
  assert.equal(record.schemaVersion, 'iscn.cnv-evidence.v1');
  assert.equal(record.authenticated, false);
  assert.equal(record.result.provisionalClassification, 'Pathogenic');
  assert.match(record.framework.doi, /10\.1038\/s41436-019-0686-8/);
  input.evidence.at(-1).score = '0';
  assert.equal(record.input.evidence.at(-1).score, '1');
  assert.equal(createCnvRecord(input, '2026-10-19T12:01:00.000Z').result.score, null);
  assert.throws(() => createCnvRecord(input, 'bad timestamp'), /timestamp/i);
});
