# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ISCN Authenticator validates ISCN (International System for Human Cytogenomic Nomenclature, 2024) karyotype strings. It is a monorepo with parallel implementations that must be kept in sync, verified by a shared fixture corpus.

## Monorepo Layout

Nothing is published. All components are consumed from source.

| Path | What |
|---|---|
| `iscn_authenticator/` | Python reference library, zero runtime deps. Installable locally via `pip install .`. |
| `packages/core/` | TypeScript port (`@iscn/core`), Deno + Node dual-runtime. Build with `npm run build` for Node; import `.ts` directly from Deno. |
| `api/` | FastAPI HTTP wrapper around the Python library. |
| `deno/` | Deno Deploy web app; imports core from `packages/core/src/`. |
| `fixtures/validity.json` | Shared valid/invalid karyotype corpus driving parity tests. |
| `tests/test_fixtures.py` | Python fixture-driven parity test. |
| `packages/core/tests/fixtures.test.ts` | TypeScript fixture-driven parity test. |
| `.github/workflows/ci.yml` | Python matrix + Deno type-check/test + Node build smoke. |

**Dual-runtime TypeScript:** `packages/core/src/` uses `.js` import specifiers so `tsc` (Node build) emits matching filenames in `dist/`. Deno resolves `.js` specifiers back to the `.ts` source via `"unstable": ["sloppy-imports"]`, which is enabled in:
- the root `deno.json` (Deno Deploy reads this file)
- `deno/deno.json` (local Deno tasks for the web app)
- `packages/core/deno.json` (core test task)

When adding a new file to `packages/core/src/`, write its intra-package imports with `.js` extensions — never `.ts`.

## Commands

**Python tests** (from project root):
```bash
python -m unittest discover tests                              # run all tests
python -m unittest tests.test_parser                           # one test file
python -m unittest tests.test_main.TestIsValidKaryotype.test_valid_karyotypes  # one test
python -m unittest tests.test_fixtures                         # cross-impl fixture parity
```

**TypeScript tests** (from `packages/core/`):
```bash
deno test --allow-read --unstable-sloppy-imports tests/        # fixture parity + unit tests
npm install && npm run build                                   # Node build (emits dist/)
```

**Python packaging smoke** (from project root, optional):
```bash
pip install hatchling && python -m hatchling build             # builds wheel + sdist into dist/
```

**FastAPI server:**
```bash
uvicorn api.server:app --reload     # dev
python api/server.py                 # prod-like (reads $PORT, default 8000)
```

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

Note: `deno/main.ts` is the **Deno Deploy** entrypoint — it embeds the HTML inline and uses `validateKaryotypeNative` (no subprocess), while `deno/server.ts` is for local dev and serves files from `deno/static/`. The top-level `deno.json` points Deploy to `deno/main.ts`; the inner `deno/deno.json` defines tasks.

Both entry points are thin wrappers around `buildHandler()` from `deno/lib/middleware.ts`. Only the static-HTML source differs — the auth / rate-limit / security-headers / logging surface is shared, so local dev and prod cannot drift.

### Deno middleware pipeline (M1)

Inside `buildHandler`:

1. Assign `request_id` (uuid v4)
2. CORS preflight short-circuit (`OPTIONS` → 204)
3. Route dispatch
   - `GET /` → static HTML (`staticHtml` string or `staticDir` from disk)
   - `GET /health` → 200 liveness probe (no auth)
   - `GET|POST /validate` → **auth → rate-limit → body/input validation → validator**
   - Anything else → 404
4. `AppError` catch → typed error response via `errorToResponse()` (stack never exposed)
5. Non-`AppError` catch → 500 `internal`; full error sent to `errorSink` (default `console.error`), keyed to `request_id`
6. Merge security headers (HSTS, nosniff, frame-deny, referrer-policy; CSP only on HTML)
7. Emit structured-JSON request log to `logSink` (default stdout); karyotype payload is never logged

### Deno KV schema

- `keys:<sha256(plaintext)>` → `{ id, label, created_at, last_used_at, revoked_at }`
- `keys_index:<id>` → `<sha256(plaintext)>` (reverse lookup by id)
- `rl:<key_id>:<minute_bucket>` → counter, TTL ≈ 120s (two windows so we can still read the previous one)

Atomic increment via `kv.atomic().sum(...)`. Fixed-window limiter (60 req/min default); clients can burst to 2× the limit at window boundaries — acceptable for M1, swap to token-bucket post-M1 if abuse observed.

### Admin CLI (deno/admin.ts)

Key management is CLI-only; no self-serve UI in M1. Wrapped as `deno task keys:create <label>` / `keys:list` / `keys:revoke <id>`. Plaintext is shown once at create and stored only as SHA-256 hash. Revocation sets `revoked_at` — subsequent auth lookups reject.

### Deno app tests

- Unit tests per module: `deno/tests/auth_test.ts`, `ratelimit_test.ts`, `keys_test.ts`, `config_test.ts`, `errors_test.ts`, `logging_test.ts`
- Full-pipeline integration tests: `deno/tests/integration_test.ts` (27 cases — happy paths, auth failure modes, rate-limit headers, CORS, body/input validation, security-header presence, error-body sanitization, uncaught-error masking via closed-KV trick)
- Run the whole app suite with `deno task test` from `deno/`.

## Architecture

### Validation pipeline (Python)

`validate_karyotype()` in `iscn_authenticator/main.py` is the single entry point. It wires together:

1. **`KaryotypeParser`** (`parser.py`) — string → `KaryotypeAST`. Raises `ParseError` on malformed syntax. Each abnormality type has its own regex + parse method; `_parse_abnormalities` dispatches by prefix. **Dispatch order matters**: `idic(` must be checked before `i(`, `dic(` before `der(`, `rob(` before `r(`, `ins(` before `i(`, `trp(` before `t(` — otherwise shorter prefixes shadow longer ones.
2. **`RuleEngine`** (`engine.py`) — runs two rule sets against the AST:
   - AST-level rules (`ALL_CHROMOSOME_RULES`) — run once per karyotype
   - Abnormality-level rules (`ALL_ABNORMALITY_RULES`) — run once per `Abnormality`
3. **`ValidationResult`** (`models.py`) — `{ valid, errors, parsed }`.

Adding a new rule: define a `validate(ast, target) -> list[str]` function, wrap in `Rule(...)`, and append to the list in `rules/chromosome.py` or `rules/abnormality.py`. Rules return strings (one per error); empty list means pass.

Adding a new abnormality type: add a regex constant + `_parse_X` method in `KaryotypeParser`, add a dispatch branch in `_parse_abnormalities` (mind prefix ordering above), and extend the relevant dataclass fields in `models.py` if needed.

### Data model

`KaryotypeAST` carries `chromosome_count` (int or `"45~48"` range string), `sex_chromosomes` (e.g., `"XX"`, `"XY"`, `"U"` for undisclosed), `abnormalities`, optional `cell_lines` (for mosaics, split on `/`), and `modifiers`. `Abnormality.raw` always preserves the original substring including uncertainty `?` and inheritance suffixes (`mat`/`pat`/`dn`), which are stripped into separate fields before regex matching.

### Legacy functions

`main.py` still exports `_validate_total_chromosome_number`, `_validate_sex_chromosomes`, `_validate_coherence`, `_validate_abnormalities`, and `_validate_deletion_content`. These are **legacy shims** kept for backward compatibility with older tests — new logic belongs in rules, not here.

### TypeScript port

`packages/core/src/` mirrors the Python structure: `parser.ts`, `engine.ts`, `validate.ts`, `types.ts`, `rules/chromosome.ts`, `rules/abnormality.ts`. `validate.ts` exposes `validateKaryotypeNative`, re-exported from the package entry `packages/core/src/index.ts` (the public API surface of `@iscn/core`).

`deno/lib/validator.ts` is the **Deno-app-specific** multi-mode orchestrator (HTTP API / native TS / Python subprocess) — it imports from `../../packages/core/src/`. It is not part of the published `@iscn/core` package.

When changing validation semantics, update **both** `iscn_authenticator/` and `packages/core/src/` — `fixtures/validity.json` and the two `test_fixtures` suites will catch parity drift in CI.

## ISCN Reference

`iscn_2024.txt` (extracted from the PDF of the same name in the project root) is the authoritative nomenclature spec. Consult it before extending grammar coverage. `docs/plans/` contains design documents for the validation engine.
