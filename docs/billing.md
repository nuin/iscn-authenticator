# Access and billing

## Hosted Cloudflare Pages application

The current hosted product provides single-karyotype browser review, an example
library, accounts and keys, signed-in browser batch review, and a subscription-gated
customer API. It does not provide saved validation history or team roles. See
[hosted API setup](hosted-api.md) for the current paid-access contract.

The pricing and account billing pages show checkout availability only when
`BILLING_CHECKOUT_ENABLED=true` and server configuration includes a verified
monthly Stripe Price with an included allowance. Price,
currency and volume remain pending owner decisions. Unconfigured checkout is unavailable.
Do not present a commercial price, purchase entitlement, API quota, or service
level that has not been decided and implemented. A database `free` or `pro` label
alone does not define a complete commercial offering.

Browser validation does not update a server usage counter. Hosted API usage is
counted per paid subscription period, with a shared hard cap and 60 validations
per fixed UTC minute. The Deno limits below apply to a separate runtime.
Hosted D1 account keys cannot authenticate against the Deno service.

### Configured Stripe flows

The Pages billing actions create Stripe Checkout or Billing Portal sessions when
the required configuration is available. Card details are entered on Stripe's
pages. The application sends the account identifiers and billing information
needed to create those sessions; it does not send validation input to Stripe.

| Configuration | Purpose |
|---|---|
| `BILLING_CHECKOUT_ENABLED` | Explicit customer launch switch; only `true` enables new checkout |
| `STRIPE_SECRET_KEY` | Server API credential for Stripe |
| `STRIPE_PRICE_ID_PRO` | Monthly licensed Price with positive `validations_per_month` metadata |
| `STRIPE_WEBHOOK_SECRET` | Verify events at `/api/webhooks/stripe` |
| `PUBLIC_BASE_URL` | Optional callback origin; otherwise the request origin is used |

For setup before customer launch, use the [private sandbox checkout command](private-checkout.md).
It accepts only test credentials and never updates production account data.
Keep the launch switch closed while adding live billing configuration. Closing
new checkout does not disable subscription maintenance webhooks or the existing
customer portal, cancel renewals, or invalidate previously issued Checkout URLs.

Checkout configuration is not evidence that a subscription is active. The server
updates account state from verified webhook events. Test checkout, cancellation,
payment failures, and event replay before enabling sales. Portal capabilities,
cancellation timing, taxes, and retry settings must be reviewed in the actual
Stripe configuration; this repository does not establish those policies.

### Pages webhook behavior

Configure the Stripe event destination at `/api/webhooks/stripe` for these events:

- `checkout.session.completed` and `checkout.session.async_payment_succeeded`
- `invoice.paid`, `invoice.payment_succeeded`, and `invoice.payment_failed`
- `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `customer.subscription.paused`, and
  `customer.subscription.resumed`

Checkout must use subscription mode and have `payment_status` equal to `paid` or
`no_payment_required` before it can associate the account with a Stripe customer.
An unpaid completion leaves the account unchanged; a later asynchronous success
can activate it. This follows Stripe's distinction between checkout completion
and delayed payment success. See [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment).

Each applicable event retrieves current subscriptions for its Stripe customer.
Only subscriptions with the configured `STRIPE_PRICE_ID_PRO` and
`metadata.customer_id` matching the local account contribute to that account's
plan. Checkout creates this metadata on the subscription. Existing subscriptions
without the matching metadata/price need operator reconciliation before they can
affect access. An event about an unrelated subscription leaves the account alone.
An existing Stripe customer association cannot be replaced by another customer.

An applicable active or trialing subscription sets `pro`; otherwise an applicable
past-due subscription sets `past_due`; otherwise the account returns to `free`.
This permits payment recovery without trusting an old invoice snapshot. A canceled
subscription cannot reactivate access, and cancellation of an old subscription
does not remove access supplied by another active matching subscription. A
scheduled cancellation remains active until Stripe changes the subscription's
status. This legacy plan label alone does not authorize API access: a separate
current entitlement requires active status, a paid latest invoice, valid item
periods and Price metadata, and no paused collection. `plan_expires_at` records
the API entitlement end or null; trialing never creates an API entitlement.

The account mutation and processed-event marker share one
[D1 batch transaction](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).
A repeated event ID cannot repeat the account mutation, including concurrent
deliveries. A failed transaction rolls both changes back. Invalid signatures,
JSON, or relevant object shapes return `400`; missing billing settings return
`503`; processing failures return a generic `500` and leave the event available
for retry. Logs include the event ID, without event payloads or provider/database
error details. Valid events that require no action are acknowledged and recorded.

### Remaining billing launch checks

Per-account reconciliation revisions prevent a delayed Stripe snapshot from
overwriting a newer committed state. A conflict returns a retryable failure;
redelivery fetches fresh state. Entitlement, account, revision and event marker
changes commit atomically. Duplicate events never reset usage. Access expires
locally at the recorded period end even if a renewal event has not arrived.

The current lookup requests at most 100 subscriptions, including canceled ones.
It fails for retry if Stripe reports more subscriptions or truncated subscription
items, so it never decides access from a partial list. Such accounts need operator
attention and pagination support; retries alone cannot fix this limit. The
provider request times out after ten seconds. Keep the configured price stable
until a migration supports previous prices. If a lifecycle event arrives before
Checkout has associated its customer, it remains retryable rather than being
discarded. Investigate events that continue failing in Stripe's delivery log.

The automated Pages webhook suite uses signed synthetic events and the actual
account schema in transactional SQLite. It covers rollback, concurrent replay,
unpaid and asynchronous checkout, ownership mismatches, payment recovery,
cancellation, unrelated subscriptions, invalid payloads, and provider failures.
Run it with Node 24 from `packages/web`:

```bash
node --test tests/billing-webhook.test.mjs
```

These tests do not replace a Stripe test-mode purchase/portal/cancellation run
against the deployed event destination. No live payment was made to establish
the automated test results.

Concurrent initial checkout attempts share a durable D1 reservation and Stripe
idempotency key. Open sessions are resumed, completed sessions block a duplicate
purchase, and unknown outcomes fail closed after 23 hours. See the
[Checkout recovery procedure](hosted-api.md#data-handling-and-operations).

Account deletion, support response times, price-change notice, refunds, and
commercial terms require owner decisions. Do not infer commitments from the
unreviewed legal templates. See [launch readiness](launch-readiness.md).

## Self-hosted Deno service

Deno has separate customer, subscription, and quota records in Deno KV. Its
`free` and `pro` tiers select these default monthly limits:

| Deno tier | Monthly quota | Per-key rate limit |
|---|---|---|
| `free` | 10,000 requests | 60/minute, burst 120 |
| `pro` | 1,000,000 requests | 60/minute, burst 120 |

Operators can configure every limit. These values are not prices or hosted Pages
allowances. Internal keys without an owning customer bypass monthly quota.
Quota resets at the next UTC month boundary. A tier change preserves the existing
usage counter. Requests beyond the monthly allowance return `402 quota_exceeded`;
rate limiting is evaluated first and returns `429`.

The Deno billing webhook is `/billing/webhook`, **not** the Pages webhook route.
Its dashboard uses `/dashboard/billing/upgrade` and `/dashboard/billing/manage`.
See the [operator guide](admin.md#stripe-webhook-setup) for configuration and the
[API reference](api.md#rate-limits-and-quota) for usage behavior.

### Deno troubleshooting

- A checkout return does not itself change the customer tier. Inspect verified
  webhook delivery and the stored subscription/customer records.
- A key rotation preserves customer-level usage. If usage appears missing,
  confirm the replacement key belongs to the same customer and deployment.
- A `402` after a tier change may reflect the stored tier or an exhausted
  configured allowance. Query `/usage` and inspect the customer record.
- A payment failure sets the Deno customer to `past_due` and its tier to `free`.
  Do not promise recovery timing; inspect subsequent subscription events.

## Before enabling commercial access

Record the price and included features, identify the legal entity and support
channel, review terms and data handling, configure the selected Stripe environment,
and verify the complete purchase lifecycle. If selling HTTP access, first define
and deploy the service customers will actually call, including its credentials
and operating commitments. The browser workspace is not that HTTP service.
