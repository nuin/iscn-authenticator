# Shared Test Fixtures

This directory holds test fixtures consumed by both the Python (`iscn_authenticator`)
and TypeScript (`@iscn/core`) implementations. The fixtures are the single source of
truth for cross-implementation correctness.

## Files

- `validity.json` — Pairs of karyotype strings and their expected validity
  (`valid` or `invalid`). Used by fixture-driven tests in both runners.

## Contract

If you change `validity.json`:

1. Run `python -m unittest tests.test_fixtures -v` — must pass.
2. Run `cd packages/core && deno test` — must pass.
3. CI runs both and will fail the PR if either disagrees.

## Adding cases

Add to `valid[]` or `invalid[]`. Each entry is `{ "input": "...", "note"|"reason": "..." }`.
Keep entries short; they run in CI on every PR.

## Out of scope for this fixture file

- Parse AST structure comparisons (future fixture file if needed)
- Error message text comparisons (error messages are implementation-specific)
- Performance benchmarks
