# ISCN Authenticator — Operator Guide

Operating the Deno app: minting keys, revoking keys, configuring the deployment, tailing logs, and understanding the Deno KV data model.

Audience: whoever runs the production deployment. Not customer-facing.

## Running locally

```bash
cd deno
deno task serve           # port 8000; reads static/ from disk; uses in-memory Deno KV (ephemeral)
deno task dev             # same, but with --watch
```

For a persistent local KV (keys and rate-limit counters survive restarts), set `KV_PATH`:

```bash
KV_PATH=./dev.kv deno task serve
```

To confirm the install is healthy:

```bash
curl http://localhost:8000/health
# → {"status":"ok"}

deno task check           # type-check every module
deno task test            # 96-test suite (auth, ratelimit, keys, integration, ...)
```

## Managing API keys

All key operations are CLI-only. Storage lives in Deno KV on the same instance that serves requests.

### Create a key

```bash
cd deno
deno task keys:create "acme-labs"
```

Output:
```
Created key for label: acme-labs

  Plaintext:  iscn_live_3f7a...e9c1
  Key ID:     k_9b2c4f7e

⚠️  Copy the plaintext now — it cannot be recovered. Only the SHA-256 hash is stored server-side.
```

- `label` is free-form; duplicates are allowed (handy for rotation — you can have two "acme-labs" keys during a rollover).
- The **plaintext is displayed exactly once**. If you lose it, the only recovery is `keys:revoke` + `keys:create`.
- The **key ID** (`k_…`) is the stable identifier you use for revoke/lookup. It shows up in structured logs as `key_id`.

### List keys

```bash
deno task keys:list
```

Output:
```
id             label        created                last_used              revoked
k_9b2c4f7e     acme-labs    2026-04-18T12:00:03Z   2026-04-18T12:31:22Z   —
k_3f7a8c21     beta-test    2026-04-15T09:14:00Z   —                      2026-04-17T18:00:00Z
```

`last_used` is updated fire-and-forget on every successful auth (non-blocking for the request).

### Revoke a key

```bash
deno task keys:revoke k_9b2c4f7e
```

Output:
```
Revoked k_9b2c4f7e at 2026-04-18T13:04:17Z
```

Revocation is **immediate**. The next request using that key returns `401 unauthenticated`. The hash is retained (not deleted) so revoked keys can't be accidentally re-issued.

### Rotating a customer's key

```bash
deno task keys:create "acme-labs"      # mint the new key, hand it to the customer
# customer confirms they've updated their systems
deno task keys:revoke k_old_id         # retire the old one
```

Overlap is cheap — two active keys for the same label cost one extra rate-limit bucket.

## Configuration (environment variables)

All are optional; defaults shown below.

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8000` | Local dev only; Deno Deploy sets its own port. |
| `RATE_LIMIT_PER_MIN` | `60` | Per-key requests per fixed-minute window. Must be ≥ 1. |
| `MAX_BODY_BYTES` | `4096` | POST body hard cap. Checked against `Content-Length` first (short-circuits before reading the body), then against actual bytes after `arrayBuffer()`. |
| `MAX_KARYOTYPE_LENGTH` | `2048` | Per-field cap (both POST body field and GET query param). |
| `ALLOWED_ORIGINS` | `*` | Comma-separated allowlist. `*` disables the check (any origin allowed). Use `https://app.example.com,https://admin.example.com` for allowlist mode. |
| `KV_PATH` | in-memory | Local dev only. Path to a SQLite file Deno KV will back with. On Deno Deploy this is ignored — KV is managed. |
| `DEBUG_ERRORS` | `false` | When `true`, 500 responses include the internal error **message** (but **never** the stack) in the response body. Dev only. |

All are read once at startup by `deno/lib/config.ts`. Changes require a restart.

## Deno Deploy

The top-level `deno.json` points Deploy to `deno/main.ts`. Deploy auto-deploys from the configured branch on push.

What Deploy provides for free:

- HTTPS + HSTS-ready edge termination
- Managed Deno KV (no setup; request `Deno.openKv()` and it works)
- Environment variables via the Deploy dashboard
- Console log retention ~24 h (upgrade for longer retention — see [Logs](#logs))

What Deploy does **not** provide:

- Long-term log retention (required for HIPAA BAA — ship to Axiom / Logtail / Datadog)
- Automatic secrets rotation (mint new keys via CLI, communicate out-of-band)
- Multi-region KV primary (edge reads go to a single primary region; expect ~50–100 ms for auth on cold edges)

### Setting env vars on Deploy

Dashboard → your project → Settings → Environment Variables.

At minimum, consider setting:
- `ALLOWED_ORIGINS` — restrict CORS for browser clients
- `RATE_LIMIT_PER_MIN` — if 60/min isn't right for your customers

## Deno KV schema

The KV instance is the only persistent state.

```
keys:<sha256(plaintext)>       → { id, label, created_at, last_used_at, revoked_at }
keys_index:<id>                → <sha256(plaintext)>     # reverse lookup by ID
rl:<key_id>:<minute_bucket>    → counter (TTL ≈ 120 s)
```

Notes:

- **Plaintext is never stored.** Only the SHA-256 digest of the plaintext is the primary-key suffix. Auth verifies by hashing the request header and looking up the same key.
- **Rate-limit TTL is two windows** so we can still read the previous window for response headers after the next window begins.
- **No migrations.** The schema is append-only; new fields get defaults.
- Inspect locally:
  ```bash
  KV_PATH=./dev.kv deno task serve &
  # in another shell:
  deno eval 'const kv = await Deno.openKv("./dev.kv"); for await (const e of kv.list({prefix:["keys"]})) console.log(e); kv.close();'
  ```

### Free-tier ceiling

Deno Deploy's free tier: 500 K reads / 20 K writes / 1 GB per day. M1 traffic patterns:

- 1 KV read per auth (cacheable post-M1)
- 1 KV atomic-increment per auth (rate limiter)
- Fire-and-forget touch-key write on first request per key per window (not per request)

That comfortably handles tens of thousands of validations per day. Scaling past the free tier is a cost signal, not a blocker.

## Logs

Every completed request emits one JSON line to stdout:

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

**The karyotype payload is not logged** by default. This is a conservative choice for the HIPAA narrative.

### Finding a specific request

Customer complains about a failed call; they forward the `request_id` from the error response:

```bash
# Deno Deploy dashboard → Logs → filter by "c5a8e3b2"
# Or via the deployctl CLI:
deployctl logs --project=<project-id> | grep c5a8e3b2
```

Uncaught 500s are logged twice — once as the request-log JSON line (`error_code: "internal"`) and once as an unstructured `console.error` line including the stack trace, both keyed to the same `request_id`.

### Long-term retention

Deno Deploy retains ~24 h of logs. That's fine for debugging, **not** for compliance claims. Before any HIPAA BAA offer, ship logs to an external sink with ≥6-year retention:

- [Axiom](https://axiom.co/) — good fit, generous free tier
- [Logtail / Better Stack](https://betterstack.com/logs)
- Datadog / Grafana Cloud — heavier-weight

Point them at stdout via a Deno Deploy log-drain integration.

## Incident playbook

### Leaked key

1. Customer reports or you spot a key in a public repo / commit.
2. `deno task keys:list` — note the `id` for the label.
3. `deno task keys:revoke <id>`.
4. `deno task keys:create "<label>"` — hand the new plaintext to the customer out-of-band (not email if avoidable).
5. File a retro: how was it leaked? Update the customer onboarding doc.

### Suspected abuse

1. Grep logs for the offending `key_id`.
2. If legitimate but noisy, raise `RATE_LIMIT_PER_MIN` for the deployment (blunt tool; per-key quotas are post-M1).
3. If malicious, revoke the key (step above).
4. If the source IP is abusing `/health` or `/` (unauthenticated), add a deployment-level WAF rule or lower `MAX_BODY_BYTES` temporarily.

### Rate limiter stuck / KV inconsistency

The rate limiter is a fixed-window counter with a 120 s TTL — it's self-healing within two minutes. There is no manual "reset rate limit" command; if a customer is stuck, wait out the window.

### Bad deploy

Deno Deploy retains prior deployments; roll back from the dashboard. The KV data is shared across deployments (no migration to undo in M1).

## Pre-flight checklist before enabling billing

- [ ] `ALLOWED_ORIGINS` set to the customer's app origin(s) only
- [ ] `RATE_LIMIT_PER_MIN` set per-plan (post-M1: per-key overrides)
- [ ] External log sink wired up (retention ≥ 6 years)
- [ ] Status page / health monitor pointed at `GET /health`
- [ ] Customer onboarding doc with: [quickstart](./quickstart.md) link, [API reference](./api.md) link, support contact, SLA terms
- [ ] Key rotation procedure documented internally
- [ ] Incident response contact reachable 24/7 (or SLA says otherwise)
- [ ] HIPAA BAA template signed (if selling to covered entities — **requires external log sink first**)

## Deferred to post-M1

Explicit non-goals of M1; track in a follow-up milestone:

- Self-serve signup + dashboard + Stripe
- Per-key monthly quotas (above the per-minute rate limit)
- Token-bucket or sliding-window limiter (if fixed-window burst abuse is observed)
- In-edge auth cache (post-M1 latency optimization)
- Key rotation HTTP endpoint (customer-triggered rotation)
- Usage analytics dashboard for customers
- Signed HIPAA BAA template + SOC2 evidence collection
- IQ/OQ/PQ validated-software docs (for clinical lab sales)
