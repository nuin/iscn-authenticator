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
| `POST` | `/validate` | required | Validate a karyotype in a JSON body |
| `GET` | `/validate?karyotype=...` | required | Validate via query string |
| `OPTIONS` | `*` | none | CORS preflight (204) |

Anything else returns `404 not_found`. Unsupported methods on `/validate` return `405 method_not_allowed`.

## Authentication

Every `/validate` request must carry one of:

```
Authorization: Bearer iscn_live_<32 hex>
X-API-Key: iscn_live_<32 hex>
```

Both headers are accepted; if both are present, `Authorization` wins. Keys look like `iscn_live_abc…` (32 hex chars after the prefix). Secret scanners (GitHub, GitLab) flag the literal `iscn_live_` prefix, so leaked keys are detected automatically.

- Plaintext is shown **once** at creation. Store it securely; the server keeps only a SHA-256 hash.
- Revoked keys are rejected with `401 unauthenticated`.
- Contact your administrator to obtain or rotate a key (self-serve signup is post-M1).

## Request / response shapes

### POST /validate

**Request:**
```http
POST /validate HTTP/1.1
Host: iscn.example.com
Authorization: Bearer iscn_live_abc...
Content-Type: application/json
Content-Length: 23

{"karyotype":"46,XX"}
```

**Response (200):**
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

Invalid karyotypes still return `200` with `valid: false` and populated `errors`. `400`/`401`/`413`/`429`/`500` are reserved for protocol-level failures.

### GET /validate?karyotype=…

Same response shape. URL-encode the karyotype (commas and parentheses survive unencoded in most clients, but encode to be safe):

```bash
curl -H "Authorization: Bearer iscn_live_..." \
  'https://iscn.example.com/validate?karyotype=46%2CXX'
```

## Rate limits

Fixed-window, per-key. Default is **60 requests per minute**; configurable per deployment via `RATE_LIMIT_PER_MIN`.

Every authenticated response — 200 and 429 alike — carries:

| Header | Meaning |
|---|---|
| `X-RateLimit-Limit` | Requests allowed per window (e.g. `60`) |
| `X-RateLimit-Remaining` | Remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the next window begins |
| `Retry-After` | Seconds to wait (**429 only**) |

At window boundaries, a client can burst to roughly 2× the per-minute limit over ~1 second (fixed-window characteristic). If your workload is sensitive to that, batch or add client-side jitter.

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
| `unauthenticated` | 401 | Missing, malformed, or revoked key | Check `Authorization` / `X-API-Key`; request a new key if revoked |
| `rate_limited` | 429 | Per-key rate limit hit | Back off `Retry-After` seconds |
| `body_too_large` | 413 | Request body > `MAX_BODY_BYTES` (default 4 KB) | Shorten the karyotype; the max single-field length is 2 KB |
| `invalid_request` | 400 | Bad `Content-Type`, malformed JSON, empty / overlong / non-string karyotype, missing field | Fix the request per the `message` |
| `method_not_allowed` | 405 | Wrong method on `/validate` | Use GET or POST |
| `not_found` | 404 | Unknown route | Check the URL |
| `internal` | 500 | Unexpected server error | Retry once; report the `request_id` if it persists |

**Stack traces and internal details are never returned in the response body.** The full error is logged server-side keyed to `request_id`.

## CORS

- `Access-Control-Allow-Origin` is set when the request origin matches the deployment's `ALLOWED_ORIGINS` (comma-separated allowlist; `*` disables the check).
- Preflight (`OPTIONS`) returns `204` with the allowed method and header list.
- Credentials are **not** included in responses (we use bearer tokens, not cookies).

## Security headers

Every response carries:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`

HTML responses (the landing page) additionally carry a strict `Content-Security-Policy` limiting scripts and styles to self and inline. JSON responses do **not** include CSP (no point).

## Logging and privacy

Each request emits one structured JSON log line to stdout with:

- `ts`, `level`, `request_id`, `ip`, `method`, `path`, `status`, `latency_ms`
- `key_id` (not the plaintext), `user_agent`, `error_code`

**The karyotype string itself is never logged.** This is a conservative default for the HIPAA narrative even though karyotypes aren't PHI on their own.

Deno Deploy retains logs for roughly 24 hours. Long-term retention (required for HIPAA BAA) requires shipping to an external sink (Axiom, Logtail, Datadog) — post-M1.

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

### JavaScript (Node ≥ 18 / browser fetch)

```js
const res = await fetch("https://iscn.example.com/validate", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.ISCN_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ karyotype: "47,XY,+21" }),
});
if (res.status === 429) {
  const retry = res.headers.get("Retry-After");
  console.error(`rate limited; retry in ${retry}s`);
} else {
  console.log(await res.json());
}
```

### Bash / curl

```bash
curl -X POST https://iscn.example.com/validate \
  -H "Authorization: Bearer $ISCN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"karyotype":"47,XY,+21"}'
```

## Limits at a glance

| Limit | Default | Env var |
|---|---|---|
| Requests per key per minute | 60 | `RATE_LIMIT_PER_MIN` |
| Request body size | 4096 bytes | `MAX_BODY_BYTES` |
| Karyotype string length | 2048 bytes | `MAX_KARYOTYPE_LENGTH` |
| CORS origin allowlist | `*` | `ALLOWED_ORIGINS` |

Validation semantics — which syntactic constructs are accepted, which rules fail — are defined by ISCN 2024 and the shared [`fixtures/validity.json`](../fixtures/validity.json) corpus. The parser + rule engine live in [`packages/core/src/`](../packages/core/src/).
