import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { getValidationCoverage, validateKaryotypeNative } from '../dist/index.js';

const cases = JSON.parse(await readFile(new URL('../tests/data/complex-karyotypes.json', import.meta.url), 'utf8'));
assert.equal(cases.length, 72, 'The complete synthetic corpus must be loaded');
const python = spawnSync(process.argv[2] ?? 'python3', ['-c', `
import json, sys
from dataclasses import asdict
from iscn_authenticator import validate_karyotype, get_validation_coverage
results = []
for case in json.load(sys.stdin):
    result = validate_karyotype(case["input"])
    results.append(dict(valid=result.valid, errors=result.errors,
                        coverage=get_validation_coverage(result.parsed), parsed=asdict(result.parsed) if result.parsed else None))
print(json.dumps(results))
`], { input: JSON.stringify(cases), encoding: 'utf8', timeout: 30_000 });
if (python.error) throw python.error;
assert.equal(python.status, 0, python.stderr);
const reference = JSON.parse(python.stdout);
assert.equal(reference.length, cases.length);

function canonicalAST(ast) {
  if (!ast) return null;
  return {
    chromosome_count: ast.chromosome_count, sex_chromosomes: ast.sex_chromosomes,
    abnormalities: ast.abnormalities, raw: ast.raw, count: ast.count ?? null,
    composite: ast.composite ?? false,
    reference: ast.reference ? { ...ast.reference, multiplier: ast.reference.multiplier ?? 1, adjusted: ast.reference.adjusted ?? false } : null,
    changes: ast.changes ?? null,
    is_donor: ast.is_donor ?? false,
    modifiers: Object.fromEntries(Object.entries(ast.modifiers ?? {}).filter(([, value]) => value !== null && value !== false)),
    cell_lines: ast.cell_lines?.map(canonicalAST) ?? null,
  };
}
const results = cases.map((example, index) => {
  const result = validateKaryotypeNative(example.input);
  const coverage = getValidationCoverage(result.parsed);
  const actual = { valid: result.valid, errors: result.errors, coverage, parsed: canonicalAST(result.parsed) };
  const status = !result.valid ? 'Issues found' : coverage.level === 'supported' ? 'Checks passed' : 'Review required';
  const failures = [];
  if (status !== example.status) failures.push(`Expected ${example.status}; received ${status}`);
  for (const code of example.notes ?? []) {
    if (!coverage.notes.some((note) => note.code === code)) failures.push(`Missing coverage note ${code}`);
  }
  if (example.error && !result.errors.join(' ').includes(example.error)) failures.push(`Missing error ${example.error}`);
  if (example.cells !== undefined) {
    const cells = result.parsed?.cell_lines?.reduce((sum, line) => sum + line.count, 0) ?? result.parsed?.count;
    if (cells !== example.cells) failures.push(`Expected ${example.cells} cells; received ${cells}`);
  }
  try {
    assert.deepEqual(actual, { ...reference[index], parsed: canonicalAST(reference[index].parsed) });
  } catch (error) {
    if (!(error instanceof assert.AssertionError)) throw error;
    failures.push('Python and TypeScript differ in validity, errors, coverage or resolved structure');
  }
  return { id: example.id, input: example.input, status, ...actual, failures };
});
const failed = results.filter((result) => result.failures.length);
if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(results, null, 2) + '\n');
for (const result of results) {
  console.log(`${result.failures.length ? 'FAIL' : 'PASS'} ${result.id}: ${result.status}${result.failures.length ? `: ${result.failures.join('; ')}` : ''}`);
}
console.log(`${results.length - failed.length}/${results.length} expected outcomes and parity checks passed`);
process.exitCode = failed.length ? 1 : 0;
