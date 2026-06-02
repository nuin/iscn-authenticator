# Changelog

All notable changes to packages in this monorepo are recorded here. The
format roughly follows [Keep a Changelog](https://keepachangelog.com/);
versions are [SemVer](https://semver.org/) and on `0.x` a breaking change
bumps the minor.

For changes to the standalone `iscn-authenticator` Python package, see
the [CHANGELOG in nuin/iscn-authenticator-py](https://github.com/nuin/iscn-authenticator-py/blob/master/CHANGELOG.md).

Sections per release: **Added**, **Changed**, **Fixed**, **Removed**.

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
