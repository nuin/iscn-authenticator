# ISCN Authenticator — Operator Guide

Operating the Deno app: managing customers and keys, configuring the deployment, wiring Stripe and Axiom, tailing logs, and understanding the Deno KV data model.

Audience: whoever runs the production deployment. Not customer-facing.

## Running locally

```bash
cd deno
deno task serve           # port 8000; reads static/ from disk; uses in-memory Deno KV (ephemeral)
deno task dev             # same, but with --watch
```

For a persistent local KV (keys and counters survive restarts):

```bash
KV_PATH=./dev.kv deno task serve
```

Smoke test:

```bash
curl http://localhost:8000/health
# → {"status":"ok"}

deno task check           # type-check every module
deno task test            # full suite; expect 260+ passing after M2
```

## Managing customers and API keys

All operator actions are CLI-only. Customer self-service lives in the `/signup` endpoint and the browser dashboard; the CLI is for internal / grandfathered keys and for operator-initiated fixes.

### Customers

```bash
cd deno
deno task customers:create acme@example.com              # create free-tier customer
deno task customers:list                                 # list all
deno task customers:tier c_9b2c4f7e pro                  # change tier (free | pro)
```

### Keys

```bash
# Internal / grandfathered key (no owning customer; skips monthly quota)
deno task keys:create "acme-labs"

# Customer-owned key (enforces monthly quota)
deno task keys:create "acme-prod" --customer c_9b2c4f7e
```

Output:
```
Created key for label: acme-labs

  Plaintext:  iscn_live_3f7a...e9c1
  Key ID:     k_9b2c4f7e

⚠️  Copy the plaintext now — it cannot be recovered. Only the SHA-256 hash is stored server-side.
```

- `label` is free-form; duplicates allowed (handy for rotation).
- The **plaintext is displayed exactly once**.
- The **key ID** (`k_…`) is the stable identifier used in logs and for revoke / rotate operations.

### List, rotate, revoke

```bash
deno task keys:list                                       # all keys
deno task keys:revoke k_9b2c4f7e                          # immediate
```

Customer-triggered rotation happens through `POST /keys/rotate` (dashboard or direct API). Operator-initiated rotation is the two-step mint + revoke above.

## Configuration (environment variables)

### Core

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8000` | Local dev only; Deno Deploy sets its own. |
| `KV_PATH` | in-memory | Local dev only. Path to a SQLite file Deno KV will back with. Ignored on Deno Deploy. |
| `DENO_ENV` | `development` | Set to `production` on Deploy. Required secrets are enforced only in production. |
| `DEBUG_ERRORS` | `false` | When `true`, 500 responses include the internal error **message** (never the stack) in the body. Dev only. |

### Limits

| Variable | Default | Notes |
|---|---|---|
| `RATE_LIMIT_PER_MIN` | `60` | Token-bucket refill rate per key. |
| `RATE_LIMIT_BURST` | `2 × refill` | Token-bucket capacity per key. |
| `MONTHLY_QUOTA_FREE` | `10000` | Free-tier calendar-month request cap. |
| `MONTHLY_QUOTA_PRO` | `1000000` | Pro-tier calendar-month request cap. |
| `MAX_BODY_BYTES` | `4096` | POST body hard cap. |
| `MAX_KARYOTYPE_LENGTH` | `2048` | Per-field cap (POST body and query param). |
| `ALLOWED_ORIGINS` | `*` | Comma-separated CORS allowlist. |

### Sessions

| Variable | Default | Notes |
|---|---|---|
| `SESSION_SECRET` | auto (dev only) | Required in prod; ≥ 32 bytes. HMAC key for the session cookie. |

Dev note: if unset in development, a random secret is generated and a warning is logged. All existing sessions become invalid on restart.

### Stripe

| Variable | Default | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | unset | `sk_test_*` or `sk_live_*`. Required to create Checkout / Portal sessions. |
| `STRIPE_WEBHOOK_SECRET` | unset | `whsec_*`. Required to verify `/billing/webhook` signatures. |
| `STRIPE_PRICE_ID_PRO` | unset | `price_*`. The recurring monthly price for the Pro plan. |
| `PUBLIC_BASE_URL` | unset | Absolute URL of the deployment (e.g. `https://iscn.example.com`). Used for Stripe success / cancel callbacks. |

### Axiom (log sink)

| Variable | Default | Notes |
|---|---|---|
| `AXIOM_API_TOKEN` | unset | `xaat-*`. When both this and the dataset are set, logs tee to Axiom. |
| `AXIOM_DATASET` | unset | Axiom dataset name (e.g. `iscn-prod`). |

If either Axiom variable is missing, logs go to stdout only (no tee, no error).

All env vars are read once at startup by `deno/lib/config.ts`. Changes require a restart.

## Stripe webhook setup

One-time setup per environment.

1. Create a Product and a recurring monthly Price in the Stripe Dashboard. Copy the Price ID into `STRIPE_PRICE_ID_PRO`.
2. Create a Webhook Endpoint in the Stripe Dashboard pointing at `https://<host>/billing/webhook`.
3. Subscribe the endpoint to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
4. Copy the signing secret (`whsec_*`) from the Stripe Dashboard into `STRIPE_WEBHOOK_SECRET`.
5. Deploy; tail logs to confirm the first event lands with status 200 and a `stripe_events:<id>` idempotency marker is written.

Local testing with the Stripe CLI:

```bash
stripe listen --forward-to localhost:8000/billing/webhook
# Copy the whsec_... printed by `stripe listen` into STRIPE_WEBHOOK_SECRET
stripe trigger checkout.session.completed
```

## Deno Deploy

The top-level `deno.json` points Deploy to `deno/main.ts`. Deploy auto-deploys from the configured branch on push.

What Deploy provides for free:

- HTTPS + HSTS-ready edge termination
- Managed Deno KV
- Environment variables via the Deploy dashboard
- Console log retention ~24 h (tee to Axiom for longer retention)

What Deploy does **not** provide:

- Long-term log retention (wire Axiom for the HIPAA narrative).
- Automatic secret rotation (mint new keys via CLI, `SESSION_SECRET` rotation invalidates all sessions).
- Multi-region KV primary (edge reads go to a single primary region).

### Setting env vars on Deploy

Dashboard → your project → Settings → Environment Variables. At minimum for a production deployment with billing enabled:

- `DENO_ENV=production`
- `SESSION_SECRET=<32-byte hex>`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`, `PUBLIC_BASE_URL`
- `AXIOM_API_TOKEN`, `AXIOM_DATASET`
- `ALLOWED_ORIGINS` scoped to the customer's app origin(s)

## Deno KV schema

```
customers:<customer_id>                 → CustomerRecord
customers_by_email:<email_lowercase>    → <customer_id>
subscriptions:<customer_id>             → SubscriptionRecord
keys:<sha256(plaintext)>                → ApiKeyRecord
keys_index:<key_id>                     → <sha256(plaintext)>
key_customer:<key_id>                   → <customer_id>    # denorm for quota path
sessions:<session_id>                   → SessionRecord    # TTL 7 days
tb:<key_id>                             → { tokens, updated_ms }  # token-bucket state
usage:<customer_id>:<yyyymm>            → Deno.KvU64       # TTL ~40 days
stripe_events:<event_id>                → 1                # TTL 7 days (webhook idempotency)
signup_tb:<ip>                          → token-bucket state for /signup throttle
```

Notes:

- **Plaintext keys are never stored.** Auth hashes the request header and looks up by digest.
- **Grandfathered keys** have `customer_id = null` in `ApiKeyRecord` and lack a `key_customer:<id>` entry. They bypass monthly quota; they still go through token-bucket rate limiting.
- **No migrations.** Schema is append-only; new fields default.
- Inspect locally:
  ```bash
  KV_PATH=./dev.kv deno task serve &
  deno eval 'const kv = await Deno.openKv("./dev.kv"); for await (const e of kv.list({prefix:["customers"]})) console.log(e); kv.close();'
  ```

## Logs

Every completed request emits one JSON line to stdout and (when configured) to Axiom:

```json
{
  "ts": "2026-04-18T12:34:56.789Z",
  "level": "info",
  "request_id": "c5a8e3b2-...",
  "ip": "203.0.113.7",
  "method": "POST",
  "path": "/validate",
  "status": 200,
  "latency_ms": 3,
  "key_id": "k_9b2c4f7e",
  "user_agent": "curl/8.4.0",
  "error_code": null
}
```

**Karyotype payloads are not logged.** The log schema is stable; any future change requires a compliance review.

### Finding a specific request

```bash
# Deno Deploy dashboard → Logs → filter by request_id
# Or in Axiom (preferred for retention):
# dataset = "iscn-prod" | where request_id == "c5a8e3b2-..."
```

Uncaught 500s are double-logged: once as the request-log JSON line (`error_code: "internal"`) and once as an unstructured `console.error` line with the stack trace, both keyed to the same `request_id`.

### Long-term retention

Axiom is the first-class sink. The free tier is enough for early-stage traffic and the retention window supports the HIPAA BAA narrative. If Axiom is unavailable at request time, we log to stderr and continue serving — no synchronous retry, no head-of-line blocking.

## Incident playbook

### Leaked key

1. Customer reports or you spot a key in a public repo / commit.
2. `deno task keys:list` to find the `id` for the label.
3. `deno task keys:revoke <id>`.
4. Mint a replacement (`keys:create ... --customer <id>`) and hand off out-of-band.
5. File a retro.

### Suspected abuse

1. Query Axiom by `key_id` or `ip`.
2. If legitimate but noisy, the customer should upgrade tier (quota) or accept the per-minute rate limit.
3. If malicious, revoke the key.
4. IP-level abuse against unauthenticated routes is handled at the edge / WAF.

### Stripe webhook failures

1. Check Axiom for `route = "/billing/webhook"` with `status != 200`.
2. A `400 stripe_error` with a missing signature points at a misconfigured webhook endpoint in Stripe; re-check the signing secret.
3. A genuine replay returns `200` and leaves state unchanged thanks to `stripe_events:<id>`; no operator action needed.
4. `invoice.payment_failed` correctly sets `customer.status = past_due` and downgrades effective tier to free.

### Bad deploy

Roll back from the Deno Deploy dashboard. KV data is shared across deployments; prefer forward-only schema changes to avoid rollback surprises.

## Compliance templates

Starting-point templates for the paperwork customers ask for live under `docs/compliance/`:

- `baa_template.md` — HIPAA Business Associate Agreement
- `iq_template.md`, `oq_template.md`, `pq_template.md` — qualification records
- `soc2_evidence_outline.md` — SOC 2 Trust Services Criteria mapping
- `privacy_policy_template.md`, `terms_template.md` — public-facing legal text

Every file is marked **LEGAL REVIEW REQUIRED**. Do not sign or publish without counsel.

## Pre-flight checklist before enabling billing

- [ ] `DENO_ENV=production` and `SESSION_SECRET` set.
- [ ] Stripe env vars populated; webhook registered and verified.
- [ ] Axiom env vars populated; test ingest confirmed.
- [ ] `ALLOWED_ORIGINS` scoped to customer app origin(s).
- [ ] `RATE_LIMIT_PER_MIN` / `RATE_LIMIT_BURST` / `MONTHLY_QUOTA_*` reviewed.
- [ ] `PUBLIC_BASE_URL` set to the real hostname.
- [ ] Status page / health monitor pointed at `GET /health`.
- [ ] Compliance templates reviewed by counsel before offering to customers.
- [ ] Incident response contact reachable.
