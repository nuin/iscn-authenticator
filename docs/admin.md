# Deno operator guide

This guide is for operators of the optional **Deno service**. It covers Deno KV,
API keys, rate limiting, customer quotas, Stripe, and request logs. It does not
configure the Cloudflare Pages application, its D1 accounts, or its hosted browser
workspace. For Pages deployment, use the [release guide](release.md).

## Running locally

Use Deno 2.9.7 to match CI. Set an explicit KV path so the CLI and local server
share the same data store:

```bash
cd deno
export KV_PATH="$PWD/dev.kv"
deno task keys:create "local-evaluation"
deno task serve
```

`deno task dev` adds watch mode. The local server reads assets from `deno/static/`.
Without `KV_PATH`, `Deno.openKv()` selects its environment's default store; do not
assume this is an ephemeral in-memory database. Use a dedicated path for evaluation.

From another terminal:

```bash
curl --fail-with-body http://127.0.0.1:8000/health
# {"ok":true}
```

Run `deno task check` and `deno task test` from `deno/` before deploying. Regenerate
the embedded browser bundle from `packages/core` after core changes as described
in [AGENTS.md](../AGENTS.md).

## Managing customers and API keys

Run the following tasks against the intended deployment's KV store. A local
`KV_PATH` does not administer a separate remote service.

### Customers

```bash
deno task customers:create evaluation@example.com
deno task customers:list
deno task customers:tier c_example pro
```

Replace example IDs with actual records. Tier changes select configured monthly
quota values; they do not establish a commercial contract or price.

### Keys

```bash
# Internal key: no customer quota, still rate limited.
deno task keys:create "internal-evaluation"

# Customer-owned key: rate limited and subject to monthly quota.
deno task keys:create "lab-integration" --customer c_example

# Optional test key prefix.
deno task keys:create "test-integration" --test --customer c_example

deno task keys:list
deno task keys:revoke k_example
```

Keys have a label and stable key ID. Labels can repeat. Full plaintext is printed
once at creation and cannot be recovered from storage. Store it in the approved
secret store; do not capture it in tickets or shared logs. The server stores a
SHA-256 hash.

Customers can rotate their own key with `POST /keys/rotate`, which immediately
revokes the calling key. For an operator-led staged replacement, create and
distribute a replacement first, then revoke the old key. Revoking a key does not
by itself destroy previously created sessions.

## Configuration (environment variables)

Values are loaded at startup by `deno/lib/config.ts`; restart after changing them.

### Runtime and request handling

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8000` | Local listening port |
| `KV_PATH` | Environment default | Explicit local KV file path |
| `DENO_ENV` | Development behavior when unset | Set `production` to require a session secret |
| `DEBUG_ERRORS` | `false` | May expose internal error messages when enabled; keep false in production |
| `ALLOWED_ORIGINS` | `*` | CORS origins, comma-separated; scope to intended callers |
| `MAX_BODY_BYTES` | `16384` | Maximum POST validation body size |
| `MAX_KARYOTYPE_LENGTH` | `2048` | JavaScript string-length limit on the karyotype field |
| `RATE_LIMIT_PER_MIN` | `60` | Per-key token-bucket refill |
| `RATE_LIMIT_BURST` | Twice refill | Per-key token-bucket capacity |
| `MONTHLY_QUOTA_FREE` | `10000` | Free customer quota per UTC month |
| `MONTHLY_QUOTA_PRO` | `1000000` | Pro customer quota per UTC month |
| `SESSION_SECRET` | Random development value | HMAC session signing key; provision a strong random production secret |

A missing production session secret fails startup. Development secret generation
invalidates previous sessions on restart. Rotating a configured secret also
invalidates active Deno sessions. These settings do not affect Pages sessions.

### Billing and logs

| Variable | Default | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | Unset | Stripe API credential for checkout and portal |
| `STRIPE_WEBHOOK_SECRET` | Unset | Verify `/billing/webhook` signatures |
| `STRIPE_PRICE_ID_PRO` | Unset | Operator-selected recurring price |
| `PUBLIC_BASE_URL` | Request origin | Callback origin for Stripe flows |
| `AXIOM_API_TOKEN` | Unset | Optional log sink credential |
| `AXIOM_DATASET` | Unset | Optional log dataset; both Axiom values are needed |

`deno/lib/service_config.ts` additionally reads `PUBLIC_API_ORIGIN` for generated
API links, `AXIOM_ENDPOINT` for the ingest base, and `SCALAR_CDN_URL` for the docs
viewer. Review these values when adapting the service to another deployment.

## Stripe webhook setup

This section describes available wiring, not an instruction to enable sales.
Complete the [commercial owner decisions](launch-readiness.md) first.

1. Select the Stripe account, environment, product, and recurring price. Record
   the price in `STRIPE_PRICE_ID_PRO` and configure the server credential.
2. Register the Deno endpoint at `https://<your-deno-host>/billing/webhook`.
3. Subscribe to `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, and `invoice.payment_failed`.
4. Configure the signing secret and public callback origin.
5. Test lifecycle events and inspect both delivery results and stored customer
   state. A redirect back from checkout is not proof that the webhook completed.

The Pages app instead receives events at `/api/webhooks/stripe` and uses D1.
Never point a webhook at one runtime while expecting it to update the other.

For a local test environment:

```bash
stripe listen --forward-to localhost:8000/billing/webhook
# Configure the emitted signing secret in the local server environment.
# Exercise checkout with a local test customer to retain matching metadata.
```

The handler records accepted event IDs in Deno KV with a seven-day TTL. Replayed
recorded IDs return success without repeating the update. Investigate processing
failures before replaying an event: inspect whether its marker was already written
and whether the corresponding state update completed.

## Deno deployment

The root `deno.json` points to `deno/main.ts`, which embeds its HTML and browser
bundle. `deno/server.ts` serves local disk assets; shared middleware handles both.
Configure the deployment's branch, environment, storage, and logs explicitly.
Provider plan limits, log retention, and region settings are external deployment
properties; this repository does not establish them.

Before exposing a Deno service:

- Set `DENO_ENV=production`, a stable secret, and an appropriate CORS allowlist.
- Confirm the intended KV database and test backup/recovery procedures.
- Set and measure rate limits and quotas for the intended workload.
- Configure monitoring for `/health` and representative authenticated requests.
- Review access to logs, retention, and any Axiom forwarding.
- Test failure handling, key revocation, and deployment recovery.

## Deno KV schema

```text
customers:<customer_id>              → CustomerRecord
customers_by_email:<email_lowercase> → customer_id
subscriptions:<customer_id>          → SubscriptionRecord
keys:<sha256(plaintext)>             → ApiKeyRecord
keys_index:<key_id>                  → sha256(plaintext)
key_customer:<key_id>                → customer_id
sessions:<session_id>                → SessionRecord (seven-day TTL)
tb:<key_id>                          → { tokens, updated_ms }
usage:<customer_id>:<yyyymm>         → Deno.KvU64 (about 40-day TTL)
stripe_events:<event_id>             → 1 (seven-day TTL)
signup_tb:<ip>                       → signup token-bucket state
```

Internal keys have `customer_id = null` and no `key_customer` record. Do not treat
absence of customer quota data as a zero-usage customer. `/usage` returns 404 for
these keys. New schema fields and record formats require a migration and rollback
assessment; an append-only convention is not a substitute for that assessment.

To inspect a dedicated local store from `deno/`:

```bash
deno eval --unstable-kv '
  const kv = await Deno.openKv("./dev.kv");
  try {
    for await (const entry of kv.list({ prefix: ["customers"] })) {
      console.log(entry.key, entry.value);
    }
  } finally {
    kv.close();
  }
'
```

This prints account records. Keep the output within your authorized operating
environment rather than attaching it to public issues.

## Logs and incidents

The request logger emits request ID, timestamp, IP, method, path, status, latency,
key ID, user agent, and error code. It omits karyotype payloads and query strings.
Unexpected errors go to the error sink with the request ID. Review error content
and infrastructure logging separately; do not claim that every upstream system
has the same exclusions.

When both Axiom values are configured, logs are forwarded to that sink. A failed
forward does not block the response. Choose and verify retention, access, and
alerting for the actual account. Log forwarding is not compliance evidence by itself.

### Leaked key

1. Identify the key ID and issuing deployment.
2. Revoke it in that store and confirm authentication fails.
3. Review associated sessions and usage; revocation alone does not clear sessions.
4. Issue a replacement through the approved channel and investigate exposure.

### Unexpected traffic or quota failures

1. Correlate request IDs with key and customer records.
2. Determine whether errors reflect burst rate, monthly quota, or malformed requests.
3. Adjust a configured limit only with an understood workload and owner decision.
4. Revoke abusive credentials where appropriate; review edge controls separately.

### Stripe processing failure

Check the endpoint, environment, signing secret, event ID, customer metadata,
idempotency marker, and final stored state. Inspect the failure before replaying.
An `invoice.payment_failed` event sets Deno customer status to `past_due` and tier
to `free`; later subscription events determine subsequent state.

### Failed deployment

Use the deployment's rollback process and verify both public health and an
authenticated request afterward. KV data persists independently of code; check
schema compatibility before reverting application code.

## Readiness and legal templates

Use the [launch checklist](launch-readiness.md) for accountable owner decisions
and evidence. The [compliance directory](compliance/README.md) contains drafting
aids, not signed agreements, completed qualification, or certification.
