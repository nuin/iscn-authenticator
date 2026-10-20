# HTTP API reference

This reference describes the **self-hosted Deno service** in `deno/`. It is not a
hosted API offer. The Cloudflare Pages website does not expose `/api/validate`,
and its `/validate` route serves the browser workspace. Keys created in the
hosted dashboard are stored in D1; Deno authenticates its own keys from Deno KV.

Use the base URL of a Deno deployment you operate. Local development defaults to
`http://127.0.0.1:8000`. See [quickstart](quickstart.md) for a local setup and
[operator configuration](admin.md#configuration-environment-variables).
The [Python wrapper](#python-wrapper) has a separate contract.

## Deno endpoints

| Method | Path | Authentication | Purpose |
|---|---|---|---|
| GET | `/health` | None | Liveness; returns `{"ok":true}` |
| POST | `/signup` | None | Create a customer and show its first key once |
| POST | `/validate` | Deno API key | Check a JSON `karyotype` string |
| GET | `/validate?karyotype=...` | Deno API key | Check a URL query string |
| GET | `/usage` | Deno API key | Customer's monthly quota snapshot |
| POST | `/keys/rotate` | Deno API key | Issue a replacement and revoke the calling key |
| GET, POST | `/login` | None | Form and key-to-session login |
| POST | `/logout` | Session | End the session |
| GET | `/dashboard`, `/dashboard/keys`, `/dashboard/billing` | Session | Deno customer dashboard |
| POST | `/dashboard/billing/upgrade` | Session | Configured Stripe checkout |
| POST | `/dashboard/billing/manage` | Session | Configured Stripe portal |
| POST | `/billing/webhook` | Stripe signature | Deno subscription event handler |
| GET | `/openapi.json` | None | API schema, when supplied to the runtime |
| OPTIONS | Any path | None | CORS preflight |

The Deno runtime also serves a landing page, documentation, examples, and a
lightweight dashboard. Its UI and storage are independent of the Pages app.

## Authentication

Send either header. `Authorization` takes precedence when both are present.

```http
Authorization: Bearer iscn_live_<32 hex characters>
X-API-Key: iscn_live_<32 hex characters>
```

Full keys are shown once. The Deno service stores SHA-256 hashes and rejects
revoked keys with `401 unauthenticated`. Keep keys in a secret store; do not
embed them in browser bundles, URLs, shared examples, or source control.
Do not assume a hosting provider's secret scanner recognizes this key format.

Customer-owned keys participate in monthly quotas. Internal keys, created by
the admin CLI without a customer, bypass monthly quota but retain rate limiting.
Deno sessions use an HMAC-signed, HttpOnly, SameSite=Lax cookie with a seven-day
lifetime. This does not describe the Pages application's session implementation.

## Signup and rotation

Create a Deno customer:

```bash
curl --fail-with-body "$ISCN_API_BASE/signup" \
  -H "Content-Type: application/json" \
  -d '{"email":"evaluation@example.com"}'
```

A successful `201` response has `customer_id`, `key_id`, `plaintext`, and
`tier: "free"`. Save `plaintext` immediately. Signup has an IP-based throttle;
invalid or duplicate email addresses are rejected.

Rotate the authenticated key:

```bash
curl --fail-with-body -X POST "$ISCN_API_BASE/keys/rotate" \
  -H "Authorization: Bearer $ISCN_API_KEY"
```

The response contains `old_key_id`, `new_key`, and `new_key_id`. Rotation revokes
the old key immediately. Save and distribute the replacement through your secret
management workflow. Requests authenticated before revocation may still finish.

## Validation

Prefer POST so the input is not included in a request URL:

```bash
curl --fail-with-body "$ISCN_API_BASE/validate" \
  -H "Authorization: Bearer $ISCN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"karyotype":"46,XX"}'
```

A completed check returns HTTP `200`, whether `valid` is `true` or `false`.
Authentication, malformed requests, and limit failures use non-200 statuses.
The endpoint adds `explanation` to a parsed result and to parsed abnormalities.
Explanation source labels are `curated`, `template`, or `none`; they do not change
validation coverage.

GET is also supported. Encode query parameters rather than concatenating input:

```bash
curl --fail-with-body --get "$ISCN_API_BASE/validate" \
  -H "Authorization: Bearer $ISCN_API_KEY" \
  --data-urlencode 'karyotype=46,XX'
```

### Result contract

This is the **core result** for `46,XX`, before Deno adds explanation fields:

```json
{
  "valid": true,
  "errors": [],
  "parsed": {
    "raw": "46,XX",
    "chromosome_count": 46,
    "sex_chromosomes": "XX",
    "abnormalities": [],
    "cell_lines": null,
    "modifiers": null
  }
}
```

| Field | Type and meaning |
|---|---|
| `valid` | Boolean; no implemented rule returned an error |
| `errors` | Array of parser or rule messages |
| `parsed` | Parsed object, or `null` on parsing failure |
| `parsed.chromosome_count` | Number, range string such as `45~48`, or `null` for supported FISH-only input |
| `parsed.sex_chromosomes` | String |
| `parsed.abnormalities` | Array with `type`, `chromosome`, `breakpoints`, `inheritance`, `uncertain`, `copy_count`, and `raw` |
| `parsed.cell_lines` | Array of cell-line records, or `null` |
| `parsed.modifiers` | Modifier object, or `null`; never an empty array |
| `parsed.raw` | Original notation, retained for source comparison |
| `parsed.count` | Optional single-line bracketed metaphase count; no invented count when absent |
| Cell-line `reference` / `changes` | Optional resolved clone token and one-based source line, plus changes explicitly written in that line |
| `explanation` | Deno enrichment with `summary`, `detail`, `citation`, `refs`, and `confidence` |

TypeScript omits unused optional AST fields. The Python wrapper serializes them as
`null`; clients should accept either representation. A clone reference's source
position is one-based within its recipient or donor group, not across both groups.

`valid: true` is not proof of complete ISCN conformity. Unknown abnormalities can
pass; ordering multiple abnormal clones still needs context; accepted assay modifiers are
retained without full checks; chromosome count ranges have ascending positive
integer checks but no composition/coherence check. Keep the [coverage guide](https://iscn-web.pages.dev/docs/coverage)
with any integration acceptance criteria.

Each cell line receives the chromosome and abnormality rules. Errors begin with
`Cell line N:` for multiple-line input. Metaphase counts must be positive integers
in brackets. Normal lines must follow abnormal lines within each recipient or
donor group; `//` preserves that boundary. Among normal XX/XY lines, size comes
first, with XX before XY when counts are equal. The original AST order is retained.

For TypeScript integrations, use `getValidationCoverage(result.parsed)` from
`@iscn/core` alongside `valid`. It returns `level`, `notes`, `reference`,
`rule_version`, and `band_reference`. Coverage describes what was checked, not
whether those checks passed. This additive helper does not change the existing
HTTP result envelope. The hosted report-QC and evidence worksheets are browser
functions, not additional HTTP endpoints; see [their schemas](laboratory-review.md).

### Node request example

Use this in a trusted server process with deployment-specific environment values:

```js
const base = process.env.ISCN_API_BASE;
const key = process.env.ISCN_API_KEY;
if (!base || !key) throw new Error("Set ISCN_API_BASE and ISCN_API_KEY");

const response = await fetch(new URL("/validate", base), {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ karyotype: "46,XX" })
});
const result = await response.json();
if (!response.ok) {
  throw new Error(`${response.status}: ${result.error} (${result.request_id})`);
}
console.log(result.valid, result.errors, result.parsed);
```

## Rate limits and quota

These are **Deno defaults**, configurable by the operator. They are not hosted
Pages plan allowances.

| Setting | Default | Environment variable |
|---|---|---|
| Per-key refill | 60 requests/minute | `RATE_LIMIT_PER_MIN` |
| Per-key burst | 120; otherwise twice configured refill | `RATE_LIMIT_BURST` |
| Free customer monthly quota | 10,000 | `MONTHLY_QUOTA_FREE` |
| Pro customer monthly quota | 1,000,000 | `MONTHLY_QUOTA_PRO` |
| POST body size | 16,384 bytes | `MAX_BODY_BYTES` |
| Karyotype length | 2,048 JavaScript string code units | `MAX_KARYOTYPE_LENGTH` |

The order is authentication, token bucket, monthly quota, request parsing, then
validation. Authenticated malformed requests can therefore consume rate tokens
and monthly quota. A validation result with `valid: false` also consumes quota.

Successful validation responses include `X-RateLimit-Limit`,
`X-RateLimit-Remaining`, and `X-RateLimit-Reset`. A `429` response includes these
rate headers and `Retry-After` in seconds. Do not assume all other error responses
include rate or quota headers.

Customer-owned successful validation responses include `X-Monthly-Quota-Limit`,
`X-Monthly-Quota-Remaining`, and `X-Monthly-Quota-Reset`. Monthly reset is the start
of the next UTC calendar month. Exceeding the quota returns `402 quota_exceeded`.
Internal keys omit monthly quota headers.

```bash
curl --fail-with-body "$ISCN_API_BASE/usage" \
  -H "Authorization: Bearer $ISCN_API_KEY"
```

`/usage` returns `customer_id`, `tier`, `month` (`YYYY-MM`), `used`, `limit`,
`remaining`, and `reset_at` (Unix seconds). It does not consume validation quota.
Internal keys receive `404` because they have no customer quota record.

## Error handling

Deno errors use this envelope:

```json
{
  "error": "unauthenticated",
  "message": "Missing or invalid API key",
  "request_id": "request-specific identifier"
}
```

The message shown above is illustrative; clients should use the status and
`error` code, not exact message text.

| Code | HTTP | Action |
|---|---|---|
| `unauthenticated` | 401 | Check the key and issuing deployment |
| `rate_limited` | 429 | Wait at least `Retry-After` seconds before a bounded retry |
| `quota_exceeded` | 402 | Check the customer's configured quota and reset time |
| `body_too_large` | 413 | Reduce the body size |
| `invalid_request` | 400 | Correct JSON, content type, or field content |
| `invalid_signup` | 400 | Check email, duplicate account, or signup throttle |
| `method_not_allowed` | 405 | Use a method in the `Allow` header |
| `not_found` | 404 | Check the route or resource ownership |
| `stripe_error` | 400 | Operator should check webhook configuration |
| `internal` | 500 | Record `request_id` for operator investigation |

Review logs before repeated retries. Set `DEBUG_ERRORS=false` in production;
error messages may contain implementation details when debugging is enabled.

## Logging and transport

Deno emits request metadata including request ID, IP, method, path, status,
latency, key ID, user agent, and error code. Key IDs are identifiers, not plaintext
keys or key hashes. The request logger omits karyotype payloads and query strings.
If configured, an Axiom sink receives those logs. Review proxy and host logging
separately; application behavior does not guarantee infrastructure retention.

`ALLOWED_ORIGINS` controls CORS. The default `*` is permissive; scope it for your
deployment. CORS is not authentication. The middleware adds HSTS, nosniff,
frame-deny, and referrer-policy headers, with CSP on HTML responses.

## Python wrapper

`api/server.py` wraps the separately maintained Python library, using dependencies
locked in `api/uv.lock`. It is not the Deno service and does not implement Deno
API keys, rate limiting, quotas, sessions, or Stripe endpoints.

```bash
uv sync --project api --locked
uv run --project api --locked python -m uvicorn api.server:app --reload
```

It exposes POST `/validate` with `{"karyotype":"46,XX"}`, GET `/validate` with a
`karyotype` query parameter, and GET `/health` with `{"status":"healthy"}`.
The validation response has `valid`, `errors`, and `parsed`. Request errors use
FastAPI's `detail` shape rather than the Deno error envelope. Add and evaluate
access controls before exposing this wrapper outside a trusted environment.

The implementation and fixture tests are in [`packages/core/`](../packages/core/)
and [`api/tests/`](../api/tests/). The downloaded shared corpus is
[`packages/core/tests/fixtures/validity.json`](../packages/core/tests/fixtures/validity.json).
