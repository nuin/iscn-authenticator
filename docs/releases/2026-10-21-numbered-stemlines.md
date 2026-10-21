# Numbered stemline release

Core revision: `2026-10-20.2`. Release verification: 2026-10-21.

This extension resolves `sl1`, `sl2` and subsequent numbered stemline references
within their recipient or donor group. Reference-derived sidelines do not change
stemline numbering. Each descendant retains its original input, selected source
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
- Python implementation: `58f5a26aa94ac8e30744b5a02b062408d410f193`.
- Shared corpus tag: `fixtures-numbered-stemlines-20261020`.
- The API lockfile pins the Python archive; both branches remain unmerged.

## Verification

The first targeted run failed on numbered references, `idem` after an independent
clone, and wrong-family sideline acceptance. After implementation, 16 targeted
TypeScript tests and three Python tests (with table-driven subcases) passed.
The API regressions also failed against the previous dependency before its pin
was advanced.

| Check | Result |
|---|---|
| Complex corpus / Python–TypeScript normalized AST parity | 85/85 |
| Core Deno / Node tests | 204 / 7 passed |
| Python library suite, including properties | 301 passed |
| FastAPI, Python 3.11 and 3.14 with warnings as errors | 21 passed on each |
| Deno service suite | 288 passed |
| Web integration suite | 110 passed |
| Browser suite, including all 85 corpus cases and clone JSON export | 17 passed |
| TypeScript build, Svelte check, web build, Deno check, bundle freshness | Passed |
| Aislop | 99/100; zero errors; four existing non-fixable reference-URL warnings |

The corpus contains seven Checks passed, 38 Review required and 40 Issues found
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

Production deployment and independent review evidence are recorded after their
checks complete.
