# ISCN Authenticator — HTTP API Reference

The Deno app exposes a key-gated HTTP API for validating ISCN 2024 karyotype strings. The validator returns a structured `{ valid, errors, parsed }` result for every call.

- **Base URL (production):** set by your deployment (e.g. `https://iscn.example.com`).
- **Base URL (local dev):** `http://localhost:8000`.
- **Content-Type:** `application/json` on POST; responses are always JSON.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/` | none | HTML landing page with API-key input and inline docs |
| `GET` | `/health` | none | Liveness probe; returns `200 {"status":"ok"}` |
| `POST` | `/signup` | none | Create a customer + first API key (returns plaintext once) |
| `POST` | `/validate` | API key | Validate a karyotype in a JSON body |
| `GET` | `/validate?karyotype=...` | API key | Validate via query string |
| `GET` | `/usage` | API key | Current-month quota snapshot for the authenticated customer |
| `POST` | `/keys/rotate` | API key | Atomically issue a new key and revoke the caller's current key |
| `GET` | `/login` | none | HTML login form (dashboard entry) |
| `POST` | `/login` | none | Exchange an API key for a session cookie |
| `POST` | `/logout` | session | Destroy session, clear cookie |
| `GET` | `/dashboard` | session | Overview: tier, usage, key summary |
| `GET` | `/dashboard/keys` | session | Manage keys (rotate / revoke) |
| `GET` | `/dashboard/billing` | session | View plan and start upgrade / portal flows |
| `POST` | `/dashboard/billing/upgrade` | session | Redirect to Stripe Checkout for the Pro plan |
| `POST` | `/dashboard/billing/manage` | session | Redirect to Stripe Billing Portal |
| `POST` | `/billing/webhook` | Stripe signature | Stripe event receiver (verified HMAC, idempotent) |
| `OPTIONS` | `*` | none | CORS preflight (204) |

Anything else returns `404 not_found`. Unsupported methods on a matched route return `405 method_not_allowed` with an `Allow` header.

## Authentication

### API key

`/validate`, `/usage`, and `/keys/rotate` require a bearer key:

```
Authorization: Bearer iscn_live_<32 hex>
X-API-Key: iscn_live_<32 hex>
```

Both headers are accepted; `Authorization` wins if both are present. Keys look like `iscn_live_abc…` (32 hex chars after the prefix). Secret scanners (GitHub, GitLab) flag the literal `iscn_live_` prefix, so leaked keys are detected automatically.

- Plaintext is shown **once** at creation. Store it securely; the server keeps only a SHA-256 hash.
- Revoked keys are rejected with `401 unauthenticated`.
- Keys are either **customer-owned** (created via `/signup` or the admin CLI with `--customer`) or **grandfathered** (admin-created without a customer). Grandfathered keys skip monthly quota enforcement.

### Session cookie

Dashboard routes (`/dashboard*`, `/logout`) require a session cookie issued by `POST /login`. The cookie is HMAC-signed, HttpOnly, SameSite=Lax, and expires after 7 days.

### Stripe signature

`POST /billing/webhook` is authenticated by an HMAC signature in the `Stripe-Signature` header, verified against `STRIPE_WEBHOOK_SECRET`. Every accepted event is de-duplicated in Deno KV under `stripe_events:<event_id>` for 7 days.

## Signup

```http
POST /signup HTTP/1.1
Content-Type: application/json

{"email":"demo@example.com"}
```

Response on success (201):

```json
{
  "customer_id": "c_abc123...",
  "key_id": "k_def456...",
  "plaintext": "iscn_live_...",
  "tier": "free"
}
```

Errors: `400 invalid_signup` (bad email or duplicate). Per-IP rate limit of 10 signups per hour (token bucket keyed on `signup:<ip>`).

## Validation

### POST /validate

```http
POST /validate HTTP/1.1
Host: iscn.example.com
Authorization: Bearer iscn_live_abc...
Content-Type: application/json

{"karyotype":"46,XX"}
```

Response (200):

```json
{
  "valid": true,
  "errors": [],
  "parsed": {
    "chromosome_count": 46,
    "sex_chromosomes": "XX",
    "abnormalities": [],
    "cell_lines": [],
    "modifiers": []
  }
}
```

Invalid karyotypes still return `200` with `valid: false` and populated `errors`. Protocol-level failures (`400`, `401`, `402`, `413`, `429`, `500`) are reserved for the cases listed below.

### GET /validate?karyotype=…

```bash
curl -H "Authorization: Bearer iscn_live_..." \
  'https://iscn.example.com/validate?karyotype=46%2CXX'
```

## Usage

```http
GET /usage HTTP/1.1
Authorization: Bearer iscn_live_...
```

Response (200):

```json
{
  "customer_id": "c_abc123...",
  "tier": "pro",
  "month": "2026-04",
  "used": 4213,
  "limit": 1000000,
  "remaining": 995787,
  "reset_at": 1746057600
}
```

- `month` is the current UTC month in `YYYY-MM` form.
- `reset_at` is the Unix timestamp of the next month's start.
- Read-only: repeated `/usage` calls do **not** consume quota.
- Grandfathered keys (no owning customer) receive `404 not_found`.

## Key rotation

```http
POST /keys/rotate HTTP/1.1
Authorization: Bearer iscn_live_...
```

Response (200):

```json
{
  "old_key_id": "k_abc...",
  "new_key": "iscn_live_...",
  "new_key_id": "k_def..."
}
```

The old key is revoked immediately; any in-flight request that beats the rotation still succeeds, but subsequent calls with the old key return `401`. Swap atomically in your clients.

## Rate limits (token bucket)

Per-key token bucket. Refill rate defaults to 60 tokens/min (`RATE_LIMIT_PER_MIN`), burst defaults to `2 × refill` (`RATE_LIMIT_BURST`).

Every authenticated response carries:

| Header | Meaning |
|---|---|
| `X-RateLimit-Limit` | Bucket capacity (burst) |
| `X-RateLimit-Remaining` | Tokens currently available (floored) |
| `X-RateLimit-Reset` | Unix ts when the bucket refills to full |
| `Retry-After` | Seconds to wait (**429 only**) |

The bucket smoothly amortizes bursts — unlike a fixed-window limiter, there is no boundary-crossing 2× spike.

## Monthly quota

Customer-owned keys are additionally bounded by a monthly request quota per tier:

| Tier | Requests per calendar month | Env var |
|------|-----------------------------|---------|
| Free | 10 000 | `MONTHLY_QUOTA_FREE` |
| Pro | 1 000 000 | `MONTHLY_QUOTA_PRO` |

Every authenticated response carries:

| Header | Meaning |
|---|---|
| `X-Monthly-Quota-Limit` | Current-tier limit |
| `X-Monthly-Quota-Remaining` | Remaining this month (floor 0) |
| `X-Monthly-Quota-Reset` | Unix ts of the next UTC month start |

When the counter exceeds the tier limit, requests return `402 quota_exceeded`. Rate limiting (`429`) is evaluated **before** the quota, so a tight-loop burst hits `429` before it has a chance to exhaust the monthly counter.

Grandfathered keys (`customer_id = null`) bypass quota enforcement entirely and do not emit the quota headers.

## Error responses

All errors are JSON with a `request_id` you can quote to support for log correlation:

```json
{
  "error": "rate_limited",
  "message": "Rate limit exceeded. Try again in 37 seconds.",
  "request_id": "c5a8e3b2-..."
}
```

| Code | HTTP | Meaning | What to do |
|---|---|---|---|
| `unauthenticated` | 401 | Missing, malformed, or revoked key or session | Check credentials |
| `rate_limited` | 429 | Token bucket empty | Back off `Retry-After` seconds |
| `quota_exceeded` | 402 | Monthly tier quota exhausted | Upgrade your plan or wait for reset |
| `body_too_large` | 413 | Request body > `MAX_BODY_BYTES` | Shorten the request |
| `invalid_request` | 400 | Bad `Content-Type`, malformed JSON, bad field | Fix per the `message` |
| `invalid_signup` | 400 | Bad email, duplicate, or signup rate limited | Check inputs or try later |
| `method_not_allowed` | 405 | Wrong HTTP method | Use the method listed in `Allow` |
| `not_found` | 404 | Unknown route or resource not owned by the caller | Check the URL |
| `stripe_error` | 400 | Webhook signature missing, invalid, or body malformed | Re-send with a valid signature (Stripe handles this) |
| `internal` | 500 | Unexpected server error | Retry once; report the `request_id` |

Stack traces and internal details are never returned in the response body. The full error is logged server-side keyed to `request_id`.

## CORS

- `Access-Control-Allow-Origin` is set when the request origin matches the deployment's `ALLOWED_ORIGINS` (comma-separated allowlist; `*` disables the check).
- Preflight (`OPTIONS`) returns `204` with the allowed method and header list.
- The API surface uses bearer tokens; CORS credentials are only included on dashboard routes that rely on the session cookie.

## Security headers

Every response carries:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`

HTML responses additionally carry a strict `Content-Security-Policy` limiting scripts and styles to self and the pinned HTMX CDN origin. JSON responses do not include CSP.

## Logging and privacy

Each request emits one structured JSON log line with:

- `ts`, `level`, `request_id`, `ip`, `method`, `path`, `status`, `latency_ms`
- `key_id` (hashed identifier, not the plaintext), `user_agent`, `error_code`

**The karyotype string itself is never logged by default.** When `AXIOM_API_TOKEN` and `AXIOM_DATASET` are set, logs tee to Axiom for long-term retention (required for the HIPAA narrative). Otherwise logs go to stdout only.

## Examples

### Python

```python
import os, urllib.request, json

req = urllib.request.Request(
    "https://iscn.example.com/validate",
    data=json.dumps({"karyotype": "47,XY,+21"}).encode(),
    headers={
        "Authorization": f"Bearer {os.environ['ISCN_API_KEY']}",
        "Content-Type": "application/json",
    },
    method="POST",
)
with urllib.request.urlopen(req) as resp:
    print(json.load(resp))
```

### JavaScript

```js
const res = await fetch("https://iscn.example.com/validate", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.ISCN_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ karyotype: "47,XY,+21" }),
});
if (res.status === 402) {
  console.error("quota exceeded; upgrade your plan");
} else if (res.status === 429) {
  const retry = res.headers.get("Retry-After");
  console.error(`rate limited; retry in ${retry}s`);
} else {
  console.log(await res.json());
}
```

### Bash

```bash
curl -X POST https://iscn.example.com/validate \
  -H "Authorization: Bearer $ISCN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"karyotype":"47,XY,+21"}'
```

## Limits at a glance

| Limit | Default | Env var |
|---|---|---|
| Token-bucket refill rate | 60/min | `RATE_LIMIT_PER_MIN` |
| Token-bucket burst | 2 × refill | `RATE_LIMIT_BURST` |
| Monthly quota (free) | 10 000 | `MONTHLY_QUOTA_FREE` |
| Monthly quota (pro) | 1 000 000 | `MONTHLY_QUOTA_PRO` |
| Request body size | 4096 bytes | `MAX_BODY_BYTES` |
| Karyotype string length | 2048 bytes | `MAX_KARYOTYPE_LENGTH` |
| CORS origin allowlist | `*` | `ALLOWED_ORIGINS` |

Validation semantics — which syntactic constructs are accepted, which rules fail — are defined by ISCN 2024 and the shared [`fixtures/validity.json`](../fixtures/validity.json) corpus. The parser + rule engine live in [`packages/core/src/`](../packages/core/src/).
