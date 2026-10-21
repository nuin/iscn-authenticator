# Paid hosted validation API

Provide external laboratory customers with a server-to-server validation API on the existing Cloudflare Pages site. The user deferred price, currency and included volume; deploy the implementation without activating paid checkout or inventing commercial terms.

## Contract

- `POST /api/v1/validate`, JSON `{ "karyotype": "46,XX" }`, returns HTTP 200 for completed checks, including notation failures. Response includes core `result`, human-readable `status`, coverage notes, rule version and request ID. It uses the same validator as the browser.
- `GET /api/v1/usage` reports the current subscription-period allowance and consumption. `GET /api/v1/openapi.json` is public. Other methods receive JSON 405 responses. No input via query parameters, no cookie authentication and no cross-origin browser access.
- Dedicated `iscn_api_` keys use 256 random bits, are stored only as SHA-256 hashes, and are shown once. They cannot sign in or manage billing. Account keys cannot invoke this API. Customers create/revoke their own keys in `/dashboard/api`, with at most ten active integration keys.
- Validation requires an active, unexpired Stripe subscription for the configured monthly price. Trialing, past-due, canceled, missing or expired entitlements do not grant paid API access. Signed webhooks reconcile current provider state; expiry bounds missing renewal webhooks.
- The configured Stripe Price must have a positive integer amount, monthly recurring interval of one month, and positive integer metadata `validations_per_month`. Checkout and API subscriptions remain unavailable without complete configuration. Display the price and allowance obtained from that Price, not hardcoded commercial terms.
- One accepted validation consumes one unit, including a notation result with `valid: false`. Reject malformed envelopes without consuming a unit. All a customer's keys share a subscription-period allowance and a 60-request fixed UTC-minute limit. Concurrent requests must not exceed either cap. Return 429 with retry and usage headers. No automatic overage charges.
- Limit each string to 4096 characters and request bodies to 16 KiB, including chunked requests. Return typed JSON errors for authentication, subscription, input, rate, quota and service failures. All responses use no-store and request IDs. Log only request metadata, never bodies, notation, bearer credentials, SQL parameters or account email.
- Browser validation remains local, free and unchanged. HTTP API inputs reach Cloudflare for processing. Persist keys, entitlement periods and aggregate usage, not input/result history.

## Boundaries

No new notation semantics, Python changes, hosting migration, DNS changes, metered overages, batch API, clinical claims or fabricated payment configuration. Existing self-hosted Deno and Python endpoints keep their own contracts.

## Evidence

Exercise real SQLite statements for concurrent caps, renewal, revocation, billing reconciliation and tenant isolation. Exercise the built Pages handler and customer UI locally. Preserve existing web/browser suites and the 90-case complex corpus. Scan with aislop. Deploy after checks, then verify public protocol behavior without charging or fabricating a production subscription.

Platform references consulted: [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/), [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/), [Stripe subscription object](https://docs.stripe.com/api/subscriptions/object), [Stripe subscription lifecycle](https://docs.stripe.com/billing/subscriptions/overview).
