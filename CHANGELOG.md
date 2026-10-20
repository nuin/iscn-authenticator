# Changelog

All notable changes to packages in this monorepo are recorded here. The
format roughly follows [Keep a Changelog](https://keepachangelog.com/);
versions are [SemVer](https://semver.org/) and on `0.x` a breaking change
bumps the minor.

For changes to the standalone `iscn-authenticator` Python package, see
the [CHANGELOG in nuin/iscn-authenticator-py](https://github.com/nuin/iscn-authenticator-py/blob/master/CHANGELOG.md).

Sections per release: **Added**, **Changed**, **Fixed**, **Removed**.

---

## Complex notation testing — 2026-10-20

- Added 48 synthetic complex-notation cases, including deliberate corruptions,
  known unsupported families, nuclei fractions and branching clone references.
- Fixed compact and tab-separated `nuc ish` prefixes in TypeScript and Python.
  Their payloads remain partial coverage, with no claim of full FISH validation.
- Advanced the core rule revision to `2026-10-20`. Laboratory QC and CNV worksheet
  revisions are unchanged.

## Laboratory review update — 2026-10-19

Application/source update; no new npm or PyPI package release is implied.

### Added

- Browser-local report QC with metaphase-total reconciliation, structured-conclusion
  checks, literal prior/current finding comparison and explicit reviewer records.
- Interphase FISH copy-number construction for one hybridization/pattern, with
  explicit nuclei modes and exact comparison to a laboratory-supplied threshold.
- A constitutional CNV evidence worksheet using selected ACMG/ClinGen criteria and
  the 2021 correction, with incomplete assessments excluded from scoring.
- Hosted workflow guides, a notation coverage matrix, export contracts and a
  versioned reference register.
- Core coverage metadata, original notation, single-line metaphase counts and
  bounded related-clone reference resolution.

### Fixed

- Inferable near-diploid numerical totals, malformed chromosome-count ranges,
  invalid structural chromosome identifiers and nonexistent coarse cytobands.
- Browser status now uses shared core coverage metadata, retaining review notices
  for unsupported count inference, uncertain breakpoints and finer subbands.

### Scope

The workflows provide bounded checks and self-attested local records. They do not
establish full ISCN conformity, authenticated signoff, comprehensive CNV evidence
assessment or hematologic disease/risk classification. See
[laboratory review](docs/laboratory-review.md) and [coverage](docs/notation-coverage.md).

## `@iscn/core` (npm)

### 0.1.0 — 2026-04

First publishable release.

#### Added
- TypeScript port of the Python validator with parity against the
  shared fixture corpus.
- Public exports: `validateKaryotypeNative`, `isValidKaryotypeNative`,
  `KaryotypeAST`, `Abnormality`, `ValidationResult`, `ParseError`.
- Pure ES module build with declaration files and source maps.

#### Notes
- Zero runtime dependencies.
- Targets Node ≥ 18; runs natively in Deno via `npm:` specifier.
