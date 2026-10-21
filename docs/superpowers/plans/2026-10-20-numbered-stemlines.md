# Numbered stemlines implementation plan

> **For agentic workers:** Use superpowers:executing-plans, with test-driven development and one final independent review.

**Goal:** Resolve explicit numbered stemline references without borrowing findings from another clone family.

**Architecture:** Extend the existing clone selector in both source implementations; reuse bounded expansion and original-text provenance. No new public fields or dependencies.

**Tech stack:** TypeScript/Deno/Node, Python, SvelteKit/Cloudflare Pages.

**Spec:** Local `iscn_2024.txt`, section 6.3.4, rules a–f and example ix (lines 4250–4370), with registered publisher errata. The behavior contract below bounds implementation coverage; synthetic tests do not constitute clinical validation.

## Global constraints and behavior contract

- Maintain Python/TypeScript validity, errors, coverage and normalized AST parity.
- Review correction: `sl1` selects the first clone. Each new `slN` must be the next number and have exactly one fully written source after the last established source. Previously established sources stay fixed. Multiple candidate full lines can include descendants and require restatement; composites cannot supply a reference or be silently skipped.
- `sl` is permitted only with one preceding stemline. `idem` always selects the first clone even after an independent line; mixing idem and sl/sdl remains rejected.
- `sdl`/`sdlN` remain supported with one preceding stemline. With multiple stemlines, reject with a restatement message rather than choose a family implicitly.
- Preserve source findings, `raw`, `changes`, reference token, one-based group-local `cell_line` and multiplier behavior.
- Missing/future/zero/malformed/oversized indexes, donor-boundary references and composite references must not silently select another line.
- Keep complex cases visibly partial. Do not infer biological relatedness or clinical classification.
- Keep both existing feature branches and unrelated `.cairn`/Python `uv.lock` files intact. Existing user authorization covers commit, push and deployment, not merging or publication.

## Review focus

Check whether fully written lines can be incorrectly treated as stemlines; lineage ambiguity after later independent clones; composite and donor numbering; oversized reference indices and multipliers; source mutation or misleading provenance in exports. Tests below cover representative cases; review additional combinations deliberately.

### Task 1: Reference selection and parity

**Files:** `packages/core/src/clone-references.ts`, `packages/core/tests/numbered-stemlines.test.ts`, corresponding Python `_clone_references.py` and `tests/test_numbered_stemlines.py`, shared fixtures, complex corpus and parity script.

**Interfaces:** Consume existing `resolveCloneReference(ast, preceding)` / `resolve_clone_reference`; produce unchanged AST fields with selected source and expanded findings.

- [x] Write failing tests for two independent stemlines, repeated multipliers from sl2, sl1 after sl2, idem after an independent clone, ambiguous sdl, future/huge indexes, composites and donor boundaries. Hand-derive inherited findings and source line numbers.
- [x] Run targeted Deno/Python tests. Expected: numbered references and idem-after-independent fail before implementation; ambiguous sdl demonstrates incorrect acceptance.
- [x] Implement selection in both runtimes, add corpus cases and advance core coverage revision to `2026-10-20.2`.
- [x] Run core and Python suites and normalized parity. Expected: all pass, source findings preserved.
- [x] Commit implementation in both repositories.

### Task 2: Workspace documentation and release

**Files:** coverage guide, side guide, complex-corpus browser test, API tests/pins, fixture tag, generated Deno artifacts, release record.

**Interfaces:** Consume Task 1 provenance; display original input and the actual referenced line. Keep existing report partial-coverage behavior.

- [x] Add browser export/provenance assertions for separate stemlines, update full coverage and inline examples, publish immutable Python/fixture pins.
- [x] Build and run core, Python, API, Deno, web and browser suites; run `aislop scan -d .`. Expected: all pass; no new findings beyond four existing reference-URL false positives.
- [x] Commit release changes, obtain one fresh whole-change review, fix important findings with regression tests.
- [ ] Push and deploy Pages; run the expanded complex corpus against production. Expected: every case matches its intended outcome, with original input and group-local reference metadata intact.
- [ ] Commit verification evidence and record remaining limits.
