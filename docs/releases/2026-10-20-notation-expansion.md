# Bounded complex-notation expansion

Verified 2026-10-20. Core rule revision `2026-10-20.1`; laboratory QC revision
`2026-10-20`.

- Production: [validation workspace](https://iscn-web.pages.dev/validate) and
  [coverage guide](https://iscn-web.pages.dev/docs/coverage).
- Source: `cbf8f89fd04136d22bd8bcde728ec2d997317b73`, pushed on
  `extract-python-library-cutover` (implementation starts at `34fd37d`).
- Immutable deployment: [908e2f70.iscn-web.pages.dev](https://908e2f70.iscn-web.pages.dev).
- Cloudflare deployment: `908e2f70-5111-497c-8b56-36e2987bf8db`, Production,
  branch label `master`, reported source `cbf8f89`.
- Previous production: `e7925b71-7fce-4b4e-a8df-7e0821e9c0ed`.
- Python dependency: `7c40e5eb881a418d9139486ce41716325f3fa86b`, pushed on
  `fix/cell-line-validation`; fixture tag `fixtures-notation-expansion-20261020`.
  Both API manifest/lockfile and core fixture configuration pin these artifacts.

## Behavior

Recognizable flat derivative components now receive chromosome, band and
breakpoint checks. Composite counts belong to their own group, including mixed
composite/ordinary descriptions. Related clones support bounded multiplication,
unique certain autosomal structural subtraction and opposite numerical
cancellation. Removing an inverted chromosome retains its numerical loss unless
a written normal homologue replaces it.

Original notation and literal changes remain available beside resolved data.
The workspace labels composite groups and reference multipliers; JSON exports
retain original raw findings and expanded copy counts. Transformed clones do not
feed the report's literal previous/current comparison. The side documentation
explains these rules and their limits with synthetic examples.

## Verification

| Check | Result |
|---|---|
| Complex synthetic corpus | 73/73 expected outcomes; exact validity/errors/coverage and normalized resolved AST parity |
| Core | 176 Deno and 7 Node tests passed |
| Python | 298 tests passed; Ruff clean |
| API | 19 tests passed on each of Python 3.11 and 3.14 with warnings as errors |
| Deno service | 288 tests passed; entrypoint type checks passed |
| Web | 110 integration tests and 17 browser tests passed |
| Svelte check / production build | Passed, zero Svelte errors/warnings |
| Embedded assets | Browser bundle regenerated and freshness checked; OpenAPI embedded |
| Aislop | 99/100, zero errors/fixable warnings; four existing scientific-reference URL false positives |
| Whitespace | Passed |

A fresh reviewer found an unsafe intermediate JavaScript sum before numerical
cancellation. Paired tests demonstrated the failure before the fix. Both ports
now reject unsafe intermediate sums; C73 preserves the reproducer. No minor
findings were deferred.

All 73 cases were also entered through the canonical production browser form:
7 Checks passed, 33 Review required and 33 Issues found. FISH and multiplied-clone
JSON exports were checked. No browser errors, input-bearing requests or
localStorage entries occurred. The production coverage guide contains the new
examples and documented limits. The temporary smoke script's original footer
still printed “48/48”; its 73 per-case results and saved artifact were verified,
and that footer was corrected to report the loaded corpus size.

## Review decisions and limits

- Full derivative paths, phase and sequential-event reconstruction remain
  outside scope because they require a more complete physical chromosome model.
  Partial coverage remains visible; otherwise path inconsistencies could be missed.
- Multiple stemlines, X/Y arithmetic and general structural subtraction remain
  outside the bounded implementation. Some valid notations therefore require
  explicit restatement or manual review.
- Synthetic tests and agreement between related implementations do not establish
  biological plausibility or clinical compliance. Laboratories still need local
  validation.
- Dependency pins and production behavior were verified after code review,
  closing the release gap that a source-only review cannot assess.

No database, binding, secret or billing changes were made. No npm/PyPI package
was published and no branch was merged. Custom-domain DNS was not changed or
reverified. This evidence document is committed after deployment and does not
change the deployed build.
