# ISCN Authenticator

Validates ISCN 2024 (International System for Human Cytogenomic Nomenclature) karyotype strings.

## Documentation

- **[Quickstart](docs/quickstart.md)** — validate your first karyotype in under a minute
- **[API Reference](docs/api.md)** — endpoints, auth, rate limits, error codes
- **[Billing Guide](docs/billing.md)** — plans, quota, Stripe upgrade flow
- **[Operator Guide](docs/admin.md)** — running the service, managing keys, incident playbook
- **[Compliance Templates](docs/compliance/README.md)** — HIPAA BAA, IQ/OQ/PQ, SOC 2 evidence, privacy policy, terms

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

`validate_karyotype()` is the single entry point in both implementations. The pipeline is:

1. **Parser** — string → `KaryotypeAST`. Raises on malformed syntax.
2. **Rule engine** — runs AST-level rules (chromosome count, sex chromosomes) + per-abnormality rules.
3. **Result** — `{ valid, errors, parsed }`.

See [CLAUDE.md](CLAUDE.md) for deeper architecture notes, and [`iscn_2024.txt`](iscn_2024.txt) for the authoritative nomenclature spec.

## License

MIT
