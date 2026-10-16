# ISCN Authenticator

Validates ISCN 2024 (International System for Human Cytogenomic Nomenclature) karyotype strings.

## Documentation

- **[Quickstart](docs/quickstart.md)** — validate your first karyotype in under a minute
- **[API Reference](docs/api.md)** — endpoints, auth, rate limits, error codes
- **[Billing Guide](docs/billing.md)** — plans, quota, Stripe upgrade flow
- **[Operator Guide](docs/admin.md)** — running the service, managing keys, incident playbook
- **[Compliance Templates](docs/compliance/README.md)** — HIPAA BAA, IQ/OQ/PQ, SOC 2 evidence, privacy policy, terms

## Packages

This repository contains the TypeScript validator, API runtimes, and web app. The Python reference library and shared fixture corpus live in [iscn-authenticator-py](https://github.com/nuin/iscn-authenticator-py). TypeScript tests download the corpus at the tag pinned in [`packages/core/package.json`](packages/core/package.json) and check agreement with its expected results. Consume the TypeScript packages from source.

| Component | Location | Runtime | Purpose |
|---|---|---|---|
| Python reference library | [External repository](https://github.com/nuin/iscn-authenticator-py) | Python | Maintained separately; available as `iscn-authenticator` on PyPI. |
| `@iscn/core` | [`packages/core/`](packages/core/) | Node ≥24 / Deno 2 | TypeScript port, zero runtime deps. |
| ISCN API | [`api/`](api/) | Python ≥3.11 (FastAPI) | HTTP wrapper around the installed Python library. |
| Deno API/admin runtime | [`deno/`](deno/) | Deno 2 / Deno Deploy | Key-gated HTTP API, admin CLI, middleware, and lightweight static UI; imports core from `packages/core/src/`. |
| Web app | [`packages/web/`](packages/web/) | SvelteKit / Cloudflare Pages | Canonical dashboard and hosted product UI; consumes the local `@iscn/core` package. |

## Use

**Python library:**
```bash
python3 -m pip install 'iscn-authenticator>=0.2.0,<0.3.0'
```
```python
from iscn_authenticator import is_valid_karyotype, validate_karyotype

is_valid_karyotype("46,XX")              # True
validate_karyotype("47,XY,+21").errors   # []
```

**TypeScript (Node, from source):**
```bash
npm --prefix packages/core ci
npm --prefix packages/core run build       # emits packages/core/dist/
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

Use Node.js 24 LTS (`nvm install && nvm use` reads [`.nvmrc`](.nvmrc)) and Deno 2.9.7 to match CI.

**Python API wrapper:**

Use uv to install the dependencies pinned in `api/uv.lock` and run the wrapper from the repository root:

```bash
uv sync --project api --locked
uv run --project api --locked python -m uvicorn api.server:app --reload
```

Run the wrapper tests with `uv run --project api --locked --python 3.11 python -m unittest discover -s api/tests -v`. CI runs the same suite on Python 3.11 and 3.14. Edit dependencies in `api/pyproject.toml` and regenerate `api/uv.lock` with `uv lock --project api` when upgrading them.

Python library development and its tests belong in [iscn-authenticator-py](https://github.com/nuin/iscn-authenticator-py).

**TypeScript tests (Deno and Node):**
```bash
cd packages/core
npm ci
npm test                               # fetch pinned fixtures, then run both suites
npm run check:browser                  # fail if the embedded browser bundle is stale
```

**TypeScript and browser builds:**
```bash
cd packages/core
npm run build                         # Node package in dist/
npm run build:browser                 # embedded Deploy asset and local static file
```

After changing the core, commit the updated embedded bundle in `deno/main.ts` with the source changes. The local `deno/static/iscn-core.js` file is generated and ignored.

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

**SvelteKit web app:**

The web app uses SvelteKit 3, Vite 8, TypeScript 6, and Wrangler 4 on Node 24. Build the local core package before checking or building the web app:

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

After changing Cloudflare bindings in `packages/web/wrangler.toml`, run `npm run types:cloudflare` from `packages/web/` and commit `src/worker-configuration.d.ts`. The `--check` command verifies that the generated binding types are current. `npm test` runs HTTP integration tests against the built Pages app and a temporary local D1 database.

## Ownership Notes

- `packages/web/` is the canonical hosted product/dashboard UI.
- `deno/` owns the API surface, auth/rate-limit/security middleware, admin CLI, and Deno Deploy runtime. Its static HTML is intentionally lightweight and should not become a second full product UI.
- Deno lockfiles are local/regenerated. Commit npm `package-lock.json` files, the embedded browser bundle in `deno/main.ts`, and generated Cloudflare binding types in `packages/web/src/worker-configuration.d.ts`; other generated build outputs are ignored.

## Deno HTTP API

The `/validate` endpoint is key-gated. `GET /` (landing page), `GET /health`, `GET /signup`, `POST /signup`, `GET /login`, and `POST /login` remain unauthenticated. Dashboard routes (`/dashboard*`, `/logout`) require a session cookie.

### Getting a key

Self-serve (recommended):

```bash
curl -X POST https://your-host/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
# → { customer_id, key_id, plaintext, tier: "free" }
```

Or mint one locally with the admin CLI (grandfathered / internal). Full details in the [Operator Guide](docs/admin.md).

Keys look like `iscn_live_<32 hex>`. Plaintext is shown once at creation and stored only as a SHA-256 hash.

### Authentication

Every request to `/validate`, `/usage`, and `/keys/rotate` must carry either:

- `Authorization: Bearer <key>`, or
- `X-API-Key: <key>`

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

Per-key token bucket. Every authenticated response (200 and 429 alike) carries:

- `X-RateLimit-Limit` — bucket capacity (burst; default `120` via `RATE_LIMIT_BURST`)
- `X-RateLimit-Remaining` — tokens currently available
- `X-RateLimit-Reset` — unix timestamp when the bucket refills to full

Refill rate defaults to 60 tokens/minute (`RATE_LIMIT_PER_MIN`). Over-burst requests get `429 rate_limited` plus `Retry-After: <seconds>`.

### Monthly quota

Customer-owned keys are also bounded by a calendar-month quota:

- Free tier: 10 000 requests/month (`MONTHLY_QUOTA_FREE`)
- Pro tier: 1 000 000 requests/month (`MONTHLY_QUOTA_PRO`)

Every authenticated response carries `X-Monthly-Quota-Limit`, `X-Monthly-Quota-Remaining`, `X-Monthly-Quota-Reset`. Over-quota returns `402 quota_exceeded`. Upgrade via the dashboard at `/dashboard/billing`.

Grandfathered / internal keys (no owning customer) bypass monthly quota and do not emit the quota headers.

### Error responses

All errors are JSON and carry a `request_id` for support correlation:

```json
{ "error": "unauthenticated", "message": "...", "request_id": "..." }
```

| Code | Status | Meaning |
|---|---|---|
| `unauthenticated` | 401 | Missing, malformed, or revoked key or session |
| `rate_limited` | 429 | Token bucket empty; see `Retry-After` |
| `quota_exceeded` | 402 | Monthly tier quota exhausted; upgrade or wait for reset |
| `body_too_large` | 413 | Request body exceeds `MAX_BODY_BYTES` |
| `invalid_request` | 400 | Bad Content-Type, empty/overlong karyotype, or JSON parse error |
| `invalid_signup` | 400 | Bad email, duplicate, or signup rate limited |
| `method_not_allowed` | 405 | Wrong HTTP method for route |
| `not_found` | 404 | Unknown route |
| `stripe_error` | 400 | Webhook signature missing, invalid, or body malformed |
| `internal` | 500 | Server error; stack never leaked, logged server-side by `request_id` |

### Admin CLI (operator flows)

```bash
cd deno
deno task customers:create acme@example.com
deno task customers:tier c_9b2c4f7e pro
deno task keys:create "acme-prod" --customer c_9b2c4f7e
deno task keys:list
deno task keys:revoke k_3f7a...
```

Customers rotate their own keys via `POST /keys/rotate` or the dashboard.

### Configuration (env vars)

See the [Operator Guide](docs/admin.md#configuration-environment-variables) for the full env var surface (sessions, Stripe, Axiom). Common ones:

| Var | Default | Notes |
|---|---|---|
| `PORT` | `8000` | Local dev only |
| `RATE_LIMIT_PER_MIN` | `60` | Token-bucket refill rate |
| `RATE_LIMIT_BURST` | `2 × refill` | Token-bucket capacity |
| `MONTHLY_QUOTA_FREE` | `10000` | Free-tier monthly cap |
| `MONTHLY_QUOTA_PRO` | `1000000` | Pro-tier monthly cap |
| `MAX_BODY_BYTES` | `4096` | POST body cap; larger → 413 |
| `MAX_KARYOTYPE_LENGTH` | `2048` | Per-field cap |
| `ALLOWED_ORIGINS` | `*` | Comma-separated allowlist; `*` disables CORS check |
| `KV_PATH` | (in-memory) | Deno KV file path for local dev |
| `SESSION_SECRET` | auto (dev) | Required in prod; ≥ 32 bytes |
| `STRIPE_SECRET_KEY` | — | Required for billing; `sk_test_*` or `sk_live_*` |
| `STRIPE_WEBHOOK_SECRET` | — | Required for `/billing/webhook` signature verification |
| `AXIOM_API_TOKEN` / `AXIOM_DATASET` | — | Optional log sink; stdout-only if either is unset |
| `DEBUG_ERRORS` | `false` | Expose error message (never stack) in 500 body — dev only |

## Architecture

The TypeScript entry point is `validateKaryotypeNative()` in `packages/core/src/validate.ts`; the external Python library exposes `validate_karyotype()`. The TypeScript pipeline is:

1. **Parser** — string → `KaryotypeAST`. The parser throws on malformed syntax; the validation entry point converts that to an invalid result with `parsed: null`.
2. **Rule engine** — runs AST-level rules (chromosome count, sex chromosomes) + per-abnormality rules.
3. **Result** — `{ valid, errors, parsed }`.

See [AGENTS.md](AGENTS.md) for repository architecture and development guidance, and [`iscn_2024.txt`](iscn_2024.txt) for the authoritative nomenclature spec.

## License

MIT
