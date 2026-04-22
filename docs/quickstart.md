# ISCN Authenticator — Quickstart

Validate an ISCN 2024 karyotype string in under a minute.

## What you need

- An API key. Keys look like `iscn_live_3f7a…e9c1`.
- A way to make HTTPS requests (curl, Postman, `fetch`, `requests`, etc.).

### Get a key via self-serve signup

```bash
curl -X POST https://iscn.example.com/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
```

Response:
```json
{
  "customer_id": "c_abc123...",
  "key_id": "k_def456...",
  "plaintext": "iscn_live_...",
  "tier": "free"
}
```

The `plaintext` value is your API key. **Copy it now** — it is displayed exactly once and cannot be recovered. Only the SHA-256 hash is stored server-side.

After signup you can also manage your account in the browser dashboard at `https://iscn.example.com/login` — rotate keys, view current-month usage, and upgrade your plan.

### Or mint one locally

```bash
cd deno
deno task keys:create "my-dev-key"
```

## Your first call

```bash
curl -X POST https://iscn.example.com/validate \
  -H "Authorization: Bearer $ISCN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"karyotype":"47,XY,+21"}'
```

Response:
```json
{
  "valid": true,
  "errors": [],
  "parsed": {
    "chromosome_count": 47,
    "sex_chromosomes": "XY",
    "abnormalities": [
      {"type": "+", "chromosome": "21", "raw": "+21"}
    ],
    "cell_lines": [],
    "modifiers": []
  }
}
```

If `valid: false`, read `errors[]`:
```json
{
  "valid": false,
  "errors": ["Total chromosome count (47) does not match expected (46) from sex chromosomes (XX) + abnormalities"],
  "parsed": { "chromosome_count": 47, "sex_chromosomes": "XX", "abnormalities": [], ... }
}
```

## Common patterns

### Python

```python
import os, json, urllib.request

def validate(karyotype: str) -> dict:
    req = urllib.request.Request(
        "https://iscn.example.com/validate",
        data=json.dumps({"karyotype": karyotype}).encode(),
        headers={
            "Authorization": f"Bearer {os.environ['ISCN_API_KEY']}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)

print(validate("46,XX,del(5)(q13q33)"))
```

### Node / browser

```js
async function validate(karyotype) {
  const res = await fetch("https://iscn.example.com/validate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.ISCN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ karyotype }),
  });
  if (!res.ok && res.status !== 200) {
    const err = await res.json();
    throw new Error(`${err.error}: ${err.message} (request_id=${err.request_id})`);
  }
  return res.json();
}
```

### GET variant (simpler for read-only URLs)

```bash
curl -H "Authorization: Bearer $ISCN_API_KEY" \
  'https://iscn.example.com/validate?karyotype=46,XX'
```

## Handling rate limits

Per-key token bucket. Default refill rate **60 requests/minute**, default burst **120**. Every response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. Over-burst returns `429` with `Retry-After` (seconds):

```js
const res = await fetch(url, opts);
if (res.status === 429) {
  const wait = Number(res.headers.get("Retry-After") ?? 1);
  await new Promise(r => setTimeout(r, wait * 1000));
  return fetch(url, opts);  // retry once
}
```

For heavier workloads, batch client-side and stay under `X-RateLimit-Limit`.

## Monthly quota

Customer-owned keys are also bounded by a calendar-month quota:

- Free tier: **10 000** requests/month
- Pro tier: **1 000 000** requests/month

Every response includes `X-Monthly-Quota-Limit`, `X-Monthly-Quota-Remaining`, `X-Monthly-Quota-Reset`. Over-quota requests return **`402 quota_exceeded`**. Upgrade to Pro in the dashboard (`/dashboard/billing`) or wait for the next UTC month.

Check the current counter without consuming quota:

```bash
curl -H "Authorization: Bearer $ISCN_API_KEY" \
  https://iscn.example.com/usage
```

Response:

```json
{
  "customer_id": "c_abc123...",
  "tier": "free",
  "month": "2026-04",
  "used": 421,
  "limit": 10000,
  "remaining": 9579,
  "reset_at": 1746057600
}
```

## Rotating your key

From the dashboard, or from the API:

```bash
curl -X POST -H "Authorization: Bearer $ISCN_API_KEY" \
  https://iscn.example.com/keys/rotate
```

Swap the returned `new_key` into your client atomically — the old key is revoked immediately.

## Handling errors

All errors are JSON with a stable `error` code and a `request_id` for support:

| Code | HTTP | Likely cause | Fix |
|---|---|---|---|
| `unauthenticated` | 401 | Missing/wrong/revoked key | Check header; `/signup` for a new key or rotate via dashboard |
| `rate_limited` | 429 | Token bucket empty | Back off `Retry-After` seconds |
| `quota_exceeded` | 402 | Monthly tier quota exhausted | Upgrade in `/dashboard/billing` or wait for month reset |
| `invalid_request` | 400 | Bad Content-Type, bad JSON, empty/overlong karyotype | Read `message` and fix the payload |
| `body_too_large` | 413 | Payload > 4 KB | Shorten the karyotype string |
| `internal` | 500 | Server bug | Retry once; if it persists, email support with the `request_id` |

## What the validator accepts

Karyotype strings per **ISCN 2024** nomenclature. Supported constructs include:

- Normal cells: `46,XX`, `46,XY`, `45,X`, `47,XXY`
- Trisomies/monosomies: `47,XY,+21`, `45,XX,-18`
- Deletions / duplications / inversions: `46,XX,del(5)(q13q33)`, `46,XX,dup(1)(q21q31)`, `46,XX,inv(3)(p13p25)`
- Translocations: `46,XX,t(9;22)(q34;q11.2)`
- Mosaics (cell lines, split on `/`): `47,XY,+21[8]/46,XY[12]`
- Inheritance suffixes: `46,XY,t(9;22)(q34;q11.2)dn`
- Many more — the full grammar is driven by `iscn_2024.txt` and exercised by [`fixtures/validity.json`](../fixtures/validity.json).

If the validator rejects a karyotype that you believe is valid per ISCN 2024, open an issue with the failing string and the ISCN section reference.

## Test endpoints (no real requests)

- `GET /health` (no auth) — returns `200 {"status":"ok"}`. Use for liveness monitoring; doesn't count against rate limits.
- `GET /` (no auth) — HTML landing page with a live validator form; paste your key and try a karyotype from the browser.

## Further reading

- **[API Reference](./api.md)** — full endpoint spec, headers, limits
- **[Billing guide](./billing.md)** — plans, quota, Stripe, managing subscriptions
- **[Operator Guide](./admin.md)** — for whoever runs the service
- **[Compliance templates](./compliance/README.md)** — BAA, IQ/OQ/PQ, SOC 2, privacy, terms
- **[Repository README](../README.md)** — monorepo layout, source-install instructions
- **[ISCN 2024 nomenclature](../iscn_2024.txt)** — the authoritative reference
