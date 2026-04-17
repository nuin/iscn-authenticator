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

## Known divergences (post-M0)

The following cases were initially proposed for the `invalid` corpus but removed because the current Python library classifies them as valid under intentional or pre-existing behavior. They are tracked here as follow-ups to be revisited after the M0 consolidation milestone:

- `"47,XX"` — The Python library permits counts 47+ with two sex chromosomes to accommodate unstated aneuploidy (e.g., `47,XX,+21`). Strict ISCN interpretation would require three sex chromosomes when the count is 47 without further abnormalities. Decide whether to harden validation post-M0.
- `"46,XX,XY"` — The parser currently treats the trailing `XY` as an unknown abnormality rather than as extra sex-chromosome notation, so coherence-on-sex-chromosomes is not enforced. Decide whether to tighten the parser post-M0.

These cases will be re-added to `fixtures/validity.json` once the corresponding behavior is decided and (if needed) implemented.
