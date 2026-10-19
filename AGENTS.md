# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

ISCN Authenticator validates ISCN (International System for Human Cytogenomic Nomenclature, 2024) karyotype strings. This repository contains the TypeScript validator, service runtimes, and web app. The Python reference library is maintained separately in [iscn-authenticator-py](https://github.com/nuin/iscn-authenticator-py). The TypeScript fixture suite checks agreement with the corpus downloaded from a pinned Python release.

## Monorepo Layout

Consume the TypeScript components from source. The FastAPI wrapper installs the external `iscn-authenticator` Python package; this repository no longer contains its implementation or library tests.

| Path | What |
|---|---|
| `packages/core/` | TypeScript port (`@iscn/core`), Deno + Node dual-runtime. Build with `npm run build` for Node; import `.ts` directly from Deno. |
| `api/` | FastAPI HTTP wrapper around the external Python library; `pyproject.toml`, `uv.lock`, and wrapper tests. |
| `deno/` | Deno Deploy API/admin runtime with lightweight static UI; imports core from `packages/core/src/`. |
| `packages/web/` | SvelteKit / Cloudflare Pages app. Canonical hosted product/dashboard UI. |
| `packages/core/scripts/fetch-fixtures.mjs` | Downloads the shared corpus using the `iscn` pin in `packages/core/package.json`. |
| `packages/core/tests/fixtures/validity.json` | Downloaded valid/invalid karyotype corpus. |
| `packages/core/tests/fixtures.test.ts` | TypeScript fixture-driven parity test. |
| `.github/workflows/ci.yml` | API wrapper tests, Deno type-check/tests, Node tests/build, browser bundle freshness, and web binding types/check/build/integration tests. |

Use Node.js 24 LTS (`.nvmrc`) and Deno 2.9.7 to match CI. The Python API requires Python 3.11 or newer.

**Dual-runtime TypeScript:** `packages/core/src/` uses `.js` import specifiers so `tsc` (Node build) emits matching filenames in `dist/`. Deno resolves `.js` specifiers back to the `.ts` source via `"unstable": ["sloppy-imports"]`, which is enabled in:
- the root `deno.json` (Deno Deploy reads this file)
- `deno/deno.json` (local Deno tasks for the web app)
- `packages/core/deno.json` (core test task)

When adding a new file to `packages/core/src/`, write its intra-package imports with `.js` extensions — never `.ts`.

## Commands

**TypeScript tests** (from `packages/core/`):
```bash
npm ci
npm test                       # fetch pinned fixtures, Deno suite, Node suite
npm run test:deno               # Deno .test.ts files; requires fetched fixtures
npm run test:node               # Node .test.mjs files
npm run build                  # Node build (emits dist/)
npm run check:browser          # check embedded browser bundle without writing
npm run build:browser          # regenerate embedded and local browser bundles
```

`npm run fetch-fixtures` reads the pinned repository, tag, and path from `packages/core/package.json`. For local comparisons, `ISCN_FIXTURES_TAG_OVERRIDE` selects another release tag. Changes to shared validation semantics must be coordinated with the Python repository and reflected in the fixture pin.

**FastAPI server and tests** (from project root, using uv):
```bash
uv sync --project api --locked
uv run --project api --locked python -m uvicorn api.server:app --reload
uv run --project api --locked python api/server.py    # reads $PORT, default 8000
uv run --project api --locked --python 3.11 python -m unittest discover -s api/tests -v
```

`api/pyproject.toml` is the dependency source of truth. After changing it, run `uv lock --project api` and commit `api/uv.lock`. CI tests the HTTP wrapper on Python 3.11 and 3.14 using the lockfile.

Python library tests and packaging commands run in the external Python repository.

**SvelteKit web app** (from `packages/web/` after building core):
```bash
cd packages/core && npm ci && npm run build
cd ../web
npm ci
npm run types:cloudflare -- --check
npm run check
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

The web toolchain uses SvelteKit 3, Vite 8, TypeScript 6, and Wrangler 4. After changing `packages/web/wrangler.toml` bindings, run `npm run types:cloudflare` from `packages/web/` and commit `src/worker-configuration.d.ts`. The generated file contains binding types; environment secrets are declared separately in `src/env.d.ts`. CI checks type freshness before type-checking and runs HTTP integration tests against the built Pages app and a temporary local D1 database after the build.

**Deno (from `deno/` directory):**
```bash
deno task serve    # run server.ts (reads static/ from disk)
deno task dev      # serve with --watch
deno task cli "46,XX"              # CLI validator
deno task cli "47,XY,+21" --json
deno task check    # type-check all .ts
deno task fmt
deno task lint
```

Note: `deno/main.ts` is the **Deno Deploy** entrypoint — it embeds the HTML inline and uses `validateKaryotypeNative`, while `deno/server.ts` is for local dev and serves files from `deno/static/`. The top-level `deno.json` points Deploy to `deno/main.ts`; the inner `deno/deno.json` defines tasks.

Both entry points are thin wrappers around `buildHandler()` from `deno/lib/middleware.ts`. Only the static-HTML source differs — the auth / rate-limit / security-headers / logging surface is shared, so local dev and prod cannot drift.

After changing the core, run `npm run build:browser` from `packages/core/` and commit the updated embedded asset in `deno/main.ts`. The local `deno/static/iscn-core.js` file is generated and ignored. `npm run check:browser` rejects stale embedded code in CI; Deno tests also compare browser and source validation results.

### Deno middleware pipeline

Inside `buildHandler`:

1. Assign `request_id` (uuid v4)
2. CORS preflight short-circuit (`OPTIONS` → 204)
3. Route dispatch
   - `GET /` → static HTML (`staticHtml` string or `staticDir` from disk)
   - `GET /health` → 200 liveness probe (no auth)
   - `GET|POST /validate` → authentication, token-bucket rate limiting, monthly quota, input validation, and validator
   - Signup, session/dashboard, billing webhook, usage, key rotation, documentation, and explanation routes use their respective handlers
   - Anything else → 404
4. `AppError` catch → typed error response via `errorToResponse()` (stack never exposed)
5. Non-`AppError` catch → 500 `internal`; full error sent to `errorSink` (default `console.error`), keyed to `request_id`
6. Merge security headers (HSTS, nosniff, frame-deny, referrer-policy; CSP only on HTML)
7. Emit structured-JSON request log to `logSink` (default stdout); karyotype payload is never logged

### Deno KV schema

- `keys:<sha256(plaintext)>` → `{ id, label, env, created_at, last_used_at, revoked_at, customer_id }`
- `keys_index:<id>` → `<sha256(plaintext)>` (reverse lookup by id)
- `key_customer:<id>` → owning customer id for quota lookup
- `tb:<key_id>` → `{ tokens, updated_ms }` for token-bucket rate limiting

The limiter in `deno/lib/token_bucket.ts` refills at 60 tokens/minute by default, with a default capacity of 120, and updates state using atomic compare-and-set. Customer-owned keys also have monthly quotas; internal keys without a customer bypass monthly quota enforcement. Customer, quota, session, and billing modules define their additional KV records.

### Admin CLI (deno/admin.ts)

Operators manage keys through `deno task keys:create <label>` / `keys:list` / `keys:revoke <id>` and customers through the `customers:*` tasks. Customers can sign up and rotate keys through the service. Plaintext is shown once at create and stored only as a SHA-256 hash. Revocation sets `revoked_at` — subsequent auth lookups reject.

### Deno app tests

- Tests in `deno/tests/` cover auth, token buckets, keys, customers, quotas, sessions, signup, billing, logging, documentation, browser bundle parity, and CLI output.
- Full-pipeline integration tests in `deno/tests/integration_test.ts` exercise happy paths, auth failures, rate-limit headers, CORS, input validation, security headers, and error-body sanitization.
- Run the whole app suite with `deno task test` from `deno/`.

## Architecture

### Validation pipeline (TypeScript)

`validateKaryotypeNative()` in `packages/core/src/validate.ts` is the validation entry point. It wires together:

1. **`KaryotypeParser`** (`parser.ts`, with helpers in `abnormality-parser.ts` and `breakpoint-parser.ts`) — string → `KaryotypeAST`. Throws `ParseError` on malformed syntax. The validation entry point converts parse failures into `{ valid: false, errors, parsed: null }`. Abnormality dispatch order matters: check longer prefixes before shorter overlapping ones.
2. **`RuleEngine`** (`engine.ts`) — runs two rule sets against the AST:
   - Chromosome rules (`ALL_CHROMOSOME_RULES`) — run for each cell line, or once for single-line input
   - Abnormality rules (`ALL_ABNORMALITY_RULES`) — run for each abnormality in every cell line
   - Whole-karyotype rules (`ALL_CELL_LINE_RULES`, registered with `addKaryotypeRules`) — check cell counts and ordering across the original cell lines, preserving recipient/donor groups
3. **`ValidationResult`** (`types.ts`) — `{ valid, errors, parsed }`.

Adding a new rule: implement a `Rule` with `validate(ast, target): string[]` and append it to `ALL_CHROMOSOME_RULES` or `ALL_ABNORMALITY_RULES` in `rules/chromosome.ts` or `rules/abnormality.ts`. Rules return one string per error; an empty array means pass.

Adding a new abnormality type: update the abnormality parser and dispatch order, extend `types.ts` as needed, and add cases covering parsing and validation.

### Data model

`KaryotypeAST` carries `chromosome_count` (number, `"45~48"` range string, or `null` for FISH-only notation), `sex_chromosomes`, `abnormalities`, nullable `cell_lines` (for mosaics, split on `/`), and nullable `modifiers`. `Abnormality.raw` preserves the original substring including uncertainty `?` and inheritance suffixes (`mat`/`pat`/`dn`), which are represented separately for validation.

### TypeScript port

`packages/core/src/index.ts` is the public entry point for validation, parser/engine types, explanation helpers, and ideogram data. Use `.js` extensions for intra-package imports so the emitted Node build and Deno's sloppy-import resolution both work.

`deno/lib/validator.ts` is the **Deno-app-specific** native validator wrapper — it imports from `../../packages/core/src/`. It is not part of the `@iscn/core` package.

When changing validation semantics, coordinate changes with [iscn-authenticator-py](https://github.com/nuin/iscn-authenticator-py), update the shared corpus there, and advance the fixture release pin here. This repository's CI runs the TypeScript fixture suite and Python HTTP wrapper tests; the Python library's own tests run in its repository.

## ISCN Reference

`iscn_2024.txt` (extracted from the PDF of the same name in the project root) is the authoritative nomenclature spec. Consult it before extending grammar coverage. Historical implementation/design plans live under `docs/archive/plans/`; treat them as archive, not current operating guidance.
