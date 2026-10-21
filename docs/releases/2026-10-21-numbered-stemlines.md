# Numbered stemline release

Core revision: `2026-10-20.2`. Release verification: 2026-10-21.

This extension resolves `sl1`, `sl2` and subsequent numbered stemline references
within their recipient or donor group. New numbered sources are established sequentially only when there is exactly
one fully written source after the last established stemline. Multiple full
lines can include restated descendants and require explicit restatement.
Previously established numbered sources remain fixed. Each descendant retains its original input, selected source
line, literal additional changes and any multiplier. `idem` remains anchored to
the first clone even after another fully written clone.

The regression work exposed an ambiguity in previous `sdlN` resolution: after an
independent stemline appeared, a sideline could still be selected without a family
being established. The bounded implementation now asks for explicit restatement
in that situation. Unnumbered `sl`, composite sources, missing/future indices,
style mixing and donor boundaries retain explicit guards. This is notation
resolution, not an inference of biological clone identity.

## Source and dependency pins

- Main implementation commit: `16393531be316f0060fb6e9ed276414d88359877`.
- Python implementation: `4c597ba224301aed9da9b8af0320866db45312cb`.
- Shared corpus tag: `fixtures-numbered-stemlines-reviewed-20261021`.
- The API lockfile pins the Python archive; both branches remain unmerged.

## Verification

The first targeted run failed on numbered references, `idem` after an independent
clone, and wrong-family sideline acceptance. After implementation, 16 targeted
TypeScript tests and three Python tests (with table-driven subcases) passed.
The API regressions also failed against the previous dependency before its pin
was advanced.

| Check | Result |
|---|---|
| Complex corpus / Python–TypeScript normalized AST parity | 90/90 |
| Core Deno / Node tests | 213 / 7 passed |
| Python library suite, including properties | 304 passed |
| FastAPI, Python 3.11 and 3.14 with warnings as errors | 21 passed on each |
| Deno service suite | 288 passed |
| Web integration suite | 110 passed |
| Browser suite, including all 90 corpus cases and clone JSON export | 17 passed |
| TypeScript build, Svelte check, web build, Deno check, bundle freshness | Passed |
| Aislop | 99/100; zero errors; four existing non-fixable reference-URL warnings |

The corpus contains seven Checks passed, 41 Review required and 42 Issues found
outcomes. It is synthetic regression evidence. Python and TypeScript share design,
fixtures and reference data, so agreement establishes parity rather than
independent ISCN validation. The retained URL warnings concern stable scientific
reference links, not deployment configuration.

## Coverage and reference basis

Authority: local ISCN 2024 section 6.3.4, especially rules a–f and example ix,
with the registered [publisher erratum](https://karger.com/cgr/article/166/1/64/939149/Erratum-ISCN-2024-An-International-System-for).
See the [complete coverage guide](../notation-coverage.md#related-clone-provenance)
and the in-app coverage guide's numbered-stemline section.

General X/Y arithmetic, complete derivative reconstruction, ambiguous family
references, full assay grammar and clinical classification remain outside this
extension. Explicit numbered references do not remove ordering or reconstruction
review notices.

## Independent review and rulings

A fresh reviewer found one important contract defect: counting every fully
written line as a stemline could select a restated descendant instead of a
separate family. The paired shorthand/full-text regression failed in both ports.
Sources are now established sequentially, with exactly one intervening full
source for a new number; ambiguous or skipped establishment requires restatement.
Established sources stay fixed. This is intentionally conservative: otherwise
valid but ambiguous shorthand may need to be written out.

The same fix pass exposed a Python provenance issue with equal dataclass values.
Source positions now use object identity, matching TypeScript. Its regression
failed before the fix and passed afterward. The final targeted suites contain
20 TypeScript tests and six Python tests with subcases. Complete suites were
rerun after both fixes; no review findings were deferred.

The reviewer set aside general X/Y arithmetic, full derivative reconstruction
and clinical clone identity. These remain documented manual-review limits;
the cost is additional laboratory review, not an inferred classification.
Production behavior was also outside the review: it must be established by the
live corpus after deployment, rather than inferred from local tests.

## Production verification

Cloudflare Pages production deployment `e06f7da1-5033-4818-816c-7afdc309a844`
serves source commit `a506f13136c5b64e80d11698c60fbf1474e02d77` on the existing
production branch label `master`. Immutable deployment:
<https://e06f7da1.iscn-web.pages.dev>. Canonical product:
<https://iscn-web.pages.dev>.

All 90 expected outcomes passed through the canonical site's visible validation
form after deployment. Live JSON exports preserved FISH payloads, original clone
text, multiplied copies and separate stemline sources. The ambiguous full-text
rewrite exported no parsed structure. No page errors, entered-payload requests
or localStorage entries were observed. The live coverage guide contains the
reviewed sequential-source and ambiguity instructions.

Both source branches and immutable Python fixture tags were pushed. No branch
was merged and no package was published. The deployment warning about a dirty
checkout came from the pre-existing untracked `.cairn` file; tracked deployment
sources were committed and unchanged. Existing custom-domain DNS was not changed
as part of this release.
