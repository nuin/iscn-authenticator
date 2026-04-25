# Changelog

All notable changes to packages in this monorepo are recorded here. The
format roughly follows [Keep a Changelog](https://keepachangelog.com/);
versions are [SemVer](https://semver.org/) and on `0.x` a breaking change
bumps the minor.

Sections per release: **Added**, **Changed**, **Fixed**, **Removed**.

---

## `iscn-authenticator` (PyPI)

### 0.2.0 — 2026-04

First release tracked in this changelog.

#### Added
- ISCN 2024 grammar coverage: numerical aberrations (`+`/`-`), deletions
  (`del`), duplications (`dup`), translocations (`t`), inversions
  (`inv`), insertions (`ins`), isochromosomes (`i`/`idic`),
  derivatives (`der`/`dic`), rings (`r`), Robertsonian translocations
  (`rob`), triplications (`trp`), marker chromosomes (`mar`),
  uncertainty (`?`), inheritance suffixes (`mat`/`pat`/`dn`),
  mosaicism (cell lines split on `/`).
- AST + rule-engine architecture (`KaryotypeParser` →
  `KaryotypeAST` → `RuleEngine`); rules split into chromosome-level
  and abnormality-level lists.
- `validate_karyotype(s) -> ValidationResult` (`{ valid, errors, parsed }`)
  and `is_valid_karyotype(s) -> bool` convenience wrapper.
- Shared fixture corpus at `fixtures/validity.json` exercising both the
  Python and TypeScript implementations.

#### Notes
- Zero runtime dependencies; standard library only.
- Supports Python 3.10–3.13.

---

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
