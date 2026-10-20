# Complex-karyotype verification and FISH prefix fix

Verified 2026-10-20.

- Source commit: `a56dd3d49ee0035a2b3c2f125fe60c566c5b3307`, pushed on
  `extract-python-library-cutover`.
- Production: [iscn-web.pages.dev/validate](https://iscn-web.pages.dev/validate).
- Immutable deployment: [e7925b71.iscn-web.pages.dev](https://e7925b71.iscn-web.pages.dev).
- Cloudflare Pages deployment ID: `e7925b71-7fce-4b4e-a8df-7e0821e9c0ed`;
  environment `Production`, branch label `master`, reported source `a56dd3d`.
- Previous production: `fee4f1ea-d3e7-4d8f-a0ea-e091d6699466`.
- Python revision: `e7ea7438b4ef6aa944717b2ff5dc19cbc215abe8`; shared fixture tag:
  `fixtures-complex-review-20261020`. Both were pushed. The API dependency and
  lockfile pin the revision; the existing Python PR remains unmerged.

The change recognizes compact and tab-separated `nuc ish` prefixes before
cell-line parsing. Core rule revision is `2026-10-20`; FISH payloads still receive
partial coverage. No schema, binding, secret or billing changes were made.
No npm or PyPI package was published.

## Verification

| Check | Result |
|---|---|
| Synthetic complex corpus | 48/48 expected outcomes; identical Python/TypeScript validity, errors and coverage |
| Core test suites | 118 Deno and 7 Node tests passed |
| Python library | 292 tests passed; changed Python files passed Ruff |
| API | 17 tests passed on each of Python 3.11 and 3.14 with warnings as errors |
| Deno service | 288 tests passed; entrypoint type checks passed |
| Web integration | 108 tests passed |
| Browser suite against built Pages | 17 tests passed, including all 48 complex inputs |
| Svelte check and production build | Passed; zero Svelte errors/warnings |
| Embedded browser bundle | Regenerated and checked by core/Deno suites |
| Aislop | 99/100; zero errors/fixable warnings; four existing scientific-URL false positives |
| Whitespace checks | Passed |

After deployment, all 48 cases were entered through the canonical production
validation form. Their statuses matched the corpus: seven Checks passed,
23 Review required and 18 Issues found. Review notices were visible. The compact
FISH JSON export preserved `(D21S259)x3[25/100]`, the complete raw input, and null
cell lines/chromosome count. No browser runtime errors, input-bearing requests or
localStorage entries were observed in that session.

The [test report](../testing/complex-karyotypes.md) contains representative
examples, the full corpus link, reproduction commands, the defect investigation
and remaining grammar/diagnostic gaps. The outcomes establish the exercised
software behavior, not full ISCN compliance or clinical performance.

This evidence document is committed after deployment; it does not change the
deployed build. Custom-domain DNS was not changed or reverified in this release.
