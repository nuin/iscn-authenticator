# Hosted customer validation API

The canonical SvelteKit / Cloudflare Pages product exposes a subscription-gated customer API. It uses the same TypeScript review function as the browser. Browser validation remains local and free. Deno and Python HTTP services are separate deployments with different credentials and contracts.

**Commercial activation is pending.** The owner deferred price, currency and included monthly validations. No offering or credentials are supplied by this release. Creating integration keys does not start billing. Checkout stays unavailable without a verified configured Stripe Price, secret key and webhook secret.

## Customer surface

- `/dashboard/api`: create, copy and revoke integration keys; view current paid-period usage.
- `/dashboard/billing`: checkout when configured; existing customers can use the Stripe portal.
- `/docs/hosted-api`: request examples, Python integration, responses, errors, retries, limits and data handling.
- `/api/v1/openapi.json`: public OpenAPI 3.1 contract.
- `POST /api/v1/validate`: exactly `{"karyotype":"46,XX"}`, `Content-Type: application/json`, `Authorization: Bearer iscn_api_…`.
- `GET /api/v1/usage`: current period start/end (Unix seconds), limit, used and remaining; no unit consumption.

Website `iscn_live_…` account keys and cookies never authenticate this API. Integration keys contain 256 random bits, are revealed once and stored only as SHA-256 hashes. They cannot authenticate website sessions. Up to ten active integration keys are allowed per account; key revocation is scoped to its owner.

## Validation and accounting contract

Successful checks return HTTP 200 with `api_version`, `request_id`, `result`, `status`, `coverage`, and `validation` metadata (rule version, reference, coverage level and cytoband reference). Notation errors are successful HTTP responses with `result.valid: false`. A true valid flag with coverage notes remains **Review required**. Partial coverage and errors in later cell lines match browser behavior.

Each accepted validation consumes one unit, including invalid notation. Envelope/auth/subscription/limit rejections consume none. The allowance and 60-per-fixed-UTC-minute limit are account-wide across all keys. The allowance follows the paid subscription period, not calendar months, and unused units do not carry over. Consumption uses one atomic D1 batch transaction: conditionally reserve a minute slot while checking the key, account, entitlement and period quota, then consume a unit only for that reservation. A failed write rolls both counters back. The minute bucket is per account, independent of renewal, and never moves backward for a delayed request. New period rows preserve prior aggregate counts. No automatic overage charges or usage-based Stripe invoices are generated.

Inputs are limited to 4096 JavaScript string code units and 16384 UTF-8 body bytes, enforced while streaming. Empty input, extra fields, query strings, arrays, compressed bodies and non-JSON media types are rejected. There is no batch endpoint, browser CORS support, request idempotency or result retrieval in v1. Send individual requests with bounded concurrency. A retried accepted request consumes another unit; a timeout or unexpected failure may occur after consumption. Respect `Retry-After`, use bounded backoff, and do not retry authentication or subscription failures automatically.

The JSON error envelope is `{request_id, error: {code, message}}`; see OpenAPI for HTTP codes. Responses are `no-store`. `X-Quota-*` and `X-RateLimit-*` expose counters and reset timestamps; `X-Request-Id` matches the response UUID.

## Database migration and deployment

Run commands from `packages/web`. Existing installations already have `schema.sql` tables. **Do not replay `schema.sql` against production.** For a new installation only, initialize that base schema first. This release adds six tables in an additive, repeatable migration:

| Table | Purpose |
| --- | --- |
| `validation_api_key` | Dedicated hashed integration credentials and timestamps |
| `api_entitlement` | Current paid period, Stripe subscription/price and allowance |
| `api_usage` | Aggregate validation counts per account and period |
| `api_rate_limit` | Monotonic account-wide minute bucket and transaction reservation |
| `api_billing_state` | Revision/event marker for optimistic webhook reconciliation |
| `api_checkout_attempt` | One durable Checkout attempt per account, frozen parameters and Stripe session ID |

Apply the migration before deploying the Worker that reads these tables:

```sh
npx wrangler d1 execute DB --remote --file migrations/0001_validation_api.sql
npx wrangler d1 execute DB --remote --file migrations/0002_checkout_attempts.sql
npm run check
npm run build
npx wrangler pages deploy .svelte-kit/cloudflare --project-name iscn-web --branch master
```

The project currently initializes schema through explicit files, not Wrangler's migration-history mechanism. Local test helpers apply the base schema plus each migration to an isolated database. Both migrations use `CREATE TABLE IF NOT EXISTS`; it does not alter or delete existing rows. To roll back application code, retain the additive tables. Do not remove usage or entitlement rows as a deployment workaround.

## Configure billing when commercial terms are approved

1. In Stripe test mode, create an active, fixed-price recurring **monthly** Price (interval count 1), with a positive integer `unit_amount` and currency. Add Price metadata `validations_per_month` as a positive integer string. This is the included allowance; the key must be on the **Price**, not only its Product. Do not edit a live allowance casually: webhook reconciliation reads current Price metadata. Create a new Price when changing commercial terms.
2. Configure `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_PRO`, `STRIPE_WEBHOOK_SECRET`, and the canonical HTTPS `PUBLIC_BASE_URL` in the existing Pages project. Use the Cloudflare secret interface/CLI; never commit values or paste them into chat. No secret is exposed to the browser. The Price ID and public base URL are nonsecret configuration.
3. Outbound Stripe requests pin API version `2025-03-31.basil`, which provides item-level billing periods. Configure the webhook with that version and a signed endpoint at the canonical origin plus `/api/webhooks/stripe`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, and subscription created/updated/deleted/paused/resumed events. Keep retries enabled.
4. Configure the Stripe customer portal for payment methods, invoices and cancellation. This release supports a single API offering; do not enable arbitrary product/quantity changes in the portal. Existing subscriptions are directed to the portal rather than a second checkout. Simultaneous initial checkouts share a durable per-account attempt and Stripe idempotency key. Repeated clicks resume an open session; a completed session blocks another checkout while payment is reconciled. Confirmed expired sessions and completed sessions whose subscription is confirmed canceled or incomplete-expired can be replaced. Unknown outcomes reuse frozen request parameters for up to 23 hours, then fail closed before Stripe may prune the idempotency key.
5. Complete the test-mode sequence below. Only then configure live-mode credentials and the approved live Price. Confirm seller identity, customer support and purchase terms before enabling live checkout; these remain operator launch decisions.

Checkout availability reads and validates the configured Price, including its amount, monthly recurrence and allowance. Invalid metadata, an inactive Price or a failed Stripe lookup disables checkout. Actual price/currency/volume appear on pricing and billing pages when available; customers review the final taxes/discounts/total in Stripe.

A subscription grants API access only when Stripe's current state is active, collection is not paused, its latest expanded invoice is paid, the matching item has quantity 1 and valid start/end timestamps, and the current time falls inside that paid period. Trialing, unpaid, past-due, paused, canceled or expired states do not grant an API entitlement. A scheduled cancellation may retain access through the current paid period. An archived Price may continue serving an existing paid subscription, while checkout for that Price is disabled.

Webhooks fetch the current subscription list rather than trusting the event's possibly stale snapshot. The update, entitlement change and processed-event marker commit together in a D1 transaction. Optimistic per-account revisions reject a delayed snapshot if another reconciliation committed meanwhile; Stripe retries it against fresh state. Duplicate events do not mutate entitlements or usage. Usage is never reset by a webhook. Incomplete or paginated subscription data fails closed and requests redelivery; operators should investigate such delivery failures.

## Test-mode launch sequence

Use a dedicated nonproduction Pages environment, D1 database and Stripe test account. This suite uses synthetic local fixtures; it does not prove that a particular merchant account's live settings work.

1. Sign up, save the account key, and create a labeled integration key. Confirm it cannot log into the website, an account key cannot call the API, and unpaid access returns 402.
2. Verify the displayed test price/allowance. Complete Stripe test Checkout, deliver its signed event, and confirm API access plus the same paid-period dates in D1/dashboard.
3. Validate both `46,XX` and malformed notation. Confirm HTTP 200 for both and two consumed units. Check `GET /usage` leaves consumption unchanged.
4. Exercise the configured small test allowance and the fixed-minute limit; confirm 429, correct counters and `Retry-After`. Multiple keys must share the same limits.
5. Repeat webhook deliveries, renew the subscription, then deliver old events. Confirm the same-period count persists, a renewed paid period receives its own allowance, and old snapshots do not restore canceled access.
6. Test failed payment, immediate cancellation, end-of-period cancellation, expiry and key revocation. Confirm 402 for inactive access and 401 for revoked keys. Verify provider outage/error responses do not include notation, credentials or SQL.
7. Review logs and data handling with synthetic notation before connecting a laboratory system.

Automated verification:

```sh
npm run check
npm run build
npm test
npm run test:browser
# From repository root:
aislop scan -d .
```

The tests include real SQLite concurrency predicates, signed webhook lifecycle/revision tests, the 90-case complex corpus, a built Pages/D1 HTTP test, and Chromium create/copy/revoke behavior. No production paid subscription is fabricated for deployment smoke tests.

## Data handling and operations

The API sends notation to Cloudflare for processing. Application storage contains key hashes/labels/timestamps, entitlement, aggregate usage and pending Checkout parameters (account/billing IDs, email, Price and callback URLs); no request bodies or validation results are persisted. The structured request logger accepts only UUID, operation, method, status and duration. Unexpected failures log sanitized operational metadata. Provider access/security metadata remains separate. Avoid patient identifiers and credential-bearing URLs.

Watch 503 rates, pending Checkout conflicts and webhook delivery failures. For a stale unknown Checkout outcome, locate the original session using the attempt ID / Stripe request logs before resetting anything. Confirm it is expired or that its subscription has ended; if it completed, reconcile its webhook. Never delete an unknown attempt just to allow another purchase. A missing renewal delivery cannot extend paid access beyond its recorded end. Repair webhook configuration and redeliver after fixing a failure; do not manually set `user.plan = 'pro'` as an API activation shortcut. The API also requires a valid current entitlement.

References: [Cloudflare D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/), [Stripe subscription object](https://docs.stripe.com/api/subscriptions/object), [Stripe subscription lifecycle](https://docs.stripe.com/billing/subscriptions/overview), [Stripe currency units](https://docs.stripe.com/currencies).
