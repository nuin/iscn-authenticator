# Laboratory Review Implementation Plan

> **For agentic workers:** Use the test-driven-development and dispatching-parallel-agents skills for the independent validation, evidence worksheet and interface domains; integrate and review the complete result before deployment.

**Goal:** Deliver routine notation fixes and a documented laboratory review workspace with FISH construction and CNV evidence records.

**Architecture:** Keep shared nomenclature rules in the core/Python libraries. Place browser-local report checks and record generation in small pure web-library modules, with separate Svelte components for each workflow. All records are explicit downloads.

**Tech Stack:** TypeScript, Python, Svelte 5 / SvelteKit, Deno and Node tests, Playwright, Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-10-19-laboratory-review-design.md`

## Global constraints

- Core source imports use `.js`; no runtime dependencies in the core.
- Mirror shared validation changes in Python and update immutable fixture/dependency pins.
- Preserve existing input, identify partial coverage, and keep review payloads in browser memory.
- Never supply default clinical cutoffs or inferred clinical classifications.
- Do not change aislop configuration or the unrelated `.cairn` file.

## Review focus

- Acquired sex-chromosome changes and polyploid/composite cases must not trigger simplistic total-count errors.
- A reference to an absent clone or an unsupported assay must not silently become a complete result.
- Blank, fractional, negative, overflowing or contradictory counts must be visible errors.
- Edits after review must invalidate the record; CSV must neutralize formula injection.
- Evidence overlap, incomplete assessments and exact classification boundaries must not generate misleading CNV results.

## Task 1: Shared nomenclature fixes

Files: `packages/core/src/{parser,types,abnormality-parser}.ts`, focused new helpers/rules, core tests and external Python equivalents.

- [x] Add and run failing cases for single-line counts, numerical totals, structural chromosomes and bands, related-clone shorthand and malformed/unsupported inputs.
- [x] Consult local ISCN sections and current errata; implement bounded checks with source/version metadata.
- [x] Mirror Python behavior and fixture cases; run both full suites and advance fixture/API pins.
- [x] Document implemented grammar, exclusions and reference limitations.

## Task 2: Report QC and FISH functions

Files: `packages/web/src/lib/review/{types,report,fish,records}.ts`, `packages/web/tests/review.test.mjs`.

Interfaces: `reviewReport(input: ReportInput): ReportReview`; `buildFish(input: FishInput): FishReview`; `createReviewRecord(input, review, signoff, timestamp)`; `reviewRecordCSV(record)`.

- [x] Test total mismatch, structured conclusion conflicts, per-line percentages and previous/current set comparisons with literal expected outcomes.
- [x] Test FISH count validity, threshold equality and injection/malformed probe names.
- [x] Implement pure checks with stable issue codes and references; export input plus findings and explicit review disposition.
- [x] Verify empty/unsafe reviewer fields and spreadsheet injection; link coverage notes to guides.

## Task 3: Constitutional CNV evidence worksheet

Files: `packages/web/src/lib/review/cnv*.ts`, matching tests, worksheet component and guide.

- [x] Read the primary ACMG/ClinGen standard, capture supported criterion ranges/exclusivity and exact score boundaries in tests.
- [x] Implement cited evidence entries, completion state and provisional score summary without automatic evidence inference.
- [x] Add an accessible worksheet with export and a separate patient-specific interpretation field.
- [x] Document evidence collection, limits and reviewer responsibility with worked synthetic cases.

## Task 4: Laboratory review interface

Files: `packages/web/src/routes/review/+page.svelte`, `lib/components/review/*`, navigation links and browser tests.

- [x] Add browser tests for current/previous review, FISH generation, record export and stale-result invalidation.
- [x] Build a responsive workspace using existing visual tokens, input labels, visible errors and focus/status updates.
- [x] Keep raw notation visible; display what was checked and what remains for review.
- [x] Verify desktop/mobile layout, keyboard operation and lack of payload transmission.

## Task 5: Documentation, integration and delivery

Files: `docs/laboratory-review.md`, `docs/notation-coverage.md`, `docs/reference-register.md`, hosted guides, README, release/evaluation documentation.

- [x] Reconcile all documentation with the implemented behavior, exports and actual reference coverage.
- [x] Run core/Python, API, Deno and web suites, browser checks, type checks and builds; regenerate the embedded browser bundle.
- [x] Run `aislop scan`, resolve findings, and inspect the complete diff with an independent reviewer.
- [ ] Commit/push authorized work, deploy the tested Pages build and smoke-test live workflows.

## Execution ledger

- 2026-10-19: User authorized implementation and full documentation. Existing consent to choose design, commit/push and deploy continues. Implementation proceeds without another design approval gate.
- Scope ruling: clinical hematology risk scoring remains a documented extension rather than a guessed classifier; the approved recommendation was to consider it after routine QC and constitutional CNV evidence review.

- Final review found and resolved acquired sex-loss double counting, unsupported insertion layouts bypassing band checks, Python oversized-integer exceptions, outer structural/suffix/uncertainty parity, and omitted CSV review metadata. Independent retest matched both runtimes on 24 adversarial/source cases.
- Shared Python revision: `47e1c8124364952e0afeff71128d43e526716354`; immutable fixture tag: `fixtures-lab-review-20261019`. Both pins and the API lockfile were updated. No npm/PyPI publishing or branch merge was performed.
- Integration checks passed: core 67 Deno + 7 Node tests, Python library 290 tests, Deno service 288 tests, web 108 tests, API 16 tests on each of Python 3.11 and 3.14, browser 16 tests. Type checks, production build, binding freshness, embedded-bundle freshness and diff whitespace checks passed.
- Final Aislop scan: 99/100, zero errors or fixable warnings. Four stable citation/dataset URLs are false-positive hardcoded-environment warnings and remain intact per repository instructions.
- Side documentation uses the same guide data as hosted docs and preserves worksheet state. Desktop/mobile screenshots and keyboard/focus behavior were checked.
