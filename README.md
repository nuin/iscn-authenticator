# ISCN Authenticator

Validates ISCN 2024 (International System for Human Cytogenomic Nomenclature) karyotype strings.

## Packages

This repository is a monorepo containing parallel implementations of the same validation logic, driven by a [shared fixture corpus](fixtures/validity.json) to guarantee behavioural parity. Nothing here is published — consume from source.

| Component | Location | Runtime | Purpose |
|---|---|---|---|
| `iscn_authenticator` | [`iscn_authenticator/`](iscn_authenticator/) | Python ≥3.10 | Reference implementation, zero runtime deps. |
| `@iscn/core` | [`packages/core/`](packages/core/) | Node ≥18 / Deno | TypeScript port, zero runtime deps. |
| ISCN API | [`api/`](api/) | Python (FastAPI) | HTTP wrapper around the Python library. |
| Deno app | [`deno/`](deno/) | Deno Deploy | Web UI + HTTP API; imports core from `packages/core/src/`. |

## Use

**Python (from source):**
```bash
git clone https://github.com/nuin/iscn-authenticator
cd iscn-authenticator
pip install .                     # or: pip install -e .
```
```python
from iscn_authenticator import is_valid_karyotype, validate_karyotype

is_valid_karyotype("46,XX")              # True
validate_karyotype("47,XY,+21").errors   # []
```

**TypeScript (Node, from source):**
```bash
cd packages/core
npm install
npm run build                     # emits dist/
```
```typescript
import { isValidKaryotypeNative, validateKaryotypeNative } from "./packages/core/dist/index.js";

isValidKaryotypeNative("46,XX");              // true
validateKaryotypeNative("47,XY,+21").errors;  // []
```

**Deno (from source):**
```typescript
import { isValidKaryotypeNative } from "./packages/core/src/index.ts";
// Requires "unstable": ["sloppy-imports"] in deno.json (already configured at repo root).
```

## Development

**Python tests:**
```bash
python -m unittest discover tests
python -m unittest tests.test_fixtures    # cross-implementation fixtures
```

**TypeScript tests (Deno):**
```bash
cd packages/core
deno test --allow-read --unstable-sloppy-imports tests/
```

**TypeScript build (Node):**
```bash
cd packages/core
npm install
npm run build
```

**Deno web app (local dev):**
```bash
cd deno
deno task dev
```

**Deno app tests:**
```bash
cd deno
deno task test
```

## Deno HTTP API

The `/validate` endpoint is key-gated. `GET /` (landing page) and `GET /health` remain unauthenticated.

### Authentication

Every request to `/validate` must carry either:

- `Authorization: Bearer <key>`, or
- `X-API-Key: <key>`

Keys look like `iscn_live_<32 hex>`. Plaintext is shown once at creation and stored only as a SHA-256 hash. Contact an administrator to obtain a key, or create one locally with the admin CLI below.

```bash
# POST (JSON body)
curl -X POST https://your-host/validate \
  -H "Authorization: Bearer iscn_live_..." \
  -H "Content-Type: application/json" \
  -d '{"karyotype": "46,XX"}'

# GET (query parameter)
curl -H "Authorization: Bearer iscn_live_..." \
  'https://your-host/validate?karyotype=46,XX'
```

### Rate limits

Every authenticated response (200 and 429 alike) carries:

- `X-RateLimit-Limit` — requests per minute (default `60`; override via `RATE_LIMIT_PER_MIN`)
- `X-RateLimit-Remaining` — remaining in the current window
- `X-RateLimit-Reset` — unix timestamp of the next window boundary

Over-quota requests get `429 rate_limited` plus `Retry-After: <seconds>`.

### Error responses

All errors are JSON and carry a `request_id` for support correlation:

```json
{ "error": "unauthenticated", "message": "...", "request_id": "..." }
```

| Code | Status | Meaning |
|---|---|---|
| `unauthenticated` | 401 | Missing, malformed, or revoked key |
| `rate_limited` | 429 | Per-key rate limit hit; see `Retry-After` |
| `body_too_large` | 413 | Request body exceeds `MAX_BODY_BYTES` |
| `invalid_request` | 400 | Bad Content-Type, empty/overlong karyotype, or JSON parse error |
| `method_not_allowed` | 405 | `/validate` only supports GET and POST |
| `not_found` | 404 | Unknown route |
| `internal` | 500 | Server error; stack never leaked, logged server-side by `request_id` |

### Admin CLI (key management)

Key management is CLI-only; no self-serve UI in M1.

```bash
cd deno
deno task keys:create "acme-labs"       # prints plaintext once — copy it now
deno task keys:list                     # id, label, created, last_used, revoked
deno task keys:revoke k_3f7a...         # revokes immediately
```

### Configuration (env vars)

| Var | Default | Notes |
|---|---|---|
| `PORT` | `8000` | Local dev only |
| `RATE_LIMIT_PER_MIN` | `60` | Per-key fixed-window limit |
| `MAX_BODY_BYTES` | `4096` | POST body cap; larger → 413 |
| `MAX_KARYOTYPE_LENGTH` | `2048` | Per-field cap |
| `ALLOWED_ORIGINS` | `*` | Comma-separated allowlist; `*` disables CORS check |
| `KV_PATH` | (in-memory) | Deno KV file path for local dev |
| `DEBUG_ERRORS` | `false` | Expose error message (never stack) in 500 body — dev only |

## Architecture

`validate_karyotype()` is the single entry point in both implementations. The pipeline is:

1. **Parser** — string → `KaryotypeAST`. Raises on malformed syntax.
2. **Rule engine** — runs AST-level rules (chromosome count, sex chromosomes) + per-abnormality rules.
3. **Result** — `{ valid, errors, parsed }`.

See [CLAUDE.md](CLAUDE.md) for deeper architecture notes, and [`iscn_2024.txt`](iscn_2024.txt) for the authoritative nomenclature spec.

## License

MIT
