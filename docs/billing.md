# Access and billing

## Hosted Cloudflare Pages application

The current hosted product provides single-karyotype browser review, an example
library, accounts and keys, and signed-in browser batch review. It does not expose
a metered validation API, saved validation history, or team roles.

The pricing and account billing pages show checkout availability from server
configuration. When Stripe checkout is unconfigured, paid checkout is unavailable.
Do not present a commercial price, purchase entitlement, API quota, or service
level that has not been decided and implemented. A database `free` or `pro` label
alone does not define a complete commercial offering.

Browser validation does not update a server usage counter. There is no hosted
monthly-validation usage meter. The Deno limits below apply to a separate runtime.
Hosted D1 account keys cannot authenticate against the Deno service.

### Configured Stripe flows

The Pages billing actions create Stripe Checkout or Billing Portal sessions when
the required configuration is available. Card details are entered on Stripe's
pages. The application sends the account identifiers and billing information
needed to create those sessions; it does not send validation input to Stripe.

| Configuration | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Server API credential for Stripe |
| `STRIPE_PRICE_ID_PRO` | Recurring price selected by the product owner |
| `STRIPE_WEBHOOK_SECRET` | Verify events at `/api/webhooks/stripe` |
| `PUBLIC_BASE_URL` | Optional callback origin; otherwise the request origin is used |

Checkout configuration is not evidence that a subscription is active. The server
updates account state from verified webhook events. Test checkout, cancellation,
payment failures, and event replay before enabling sales. Portal capabilities,
cancellation timing, taxes, and retry settings must be reviewed in the actual
Stripe configuration; this repository does not establish those policies.

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
