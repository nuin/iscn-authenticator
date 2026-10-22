# Private checkout setup

This is an operator-only Stripe sandbox workflow. It creates a hosted Checkout
URL from a local command; the website does not expose a test-purchase route or
link. The URL itself grants access to the test checkout, so keep it private.
No production D1 account, subscription, usage, or entitlement is changed.

Customer checkout is separately controlled by `BILLING_CHECKOUT_ENABLED`. Missing,
`false`, or any value other than exactly `true` keeps public pricing and the
upgrade action closed, even when Stripe credentials are present. Existing billing
portal access and signed webhook processing remain available for subscription
maintenance. This switch does not cancel subscriptions or expire previously
created Stripe Checkout URLs.

## Connect the sandbox

1. Sign in to the correct Bioinformat Stripe account and create or select a
   dedicated sandbox. A sandbox keeps settings and data separate from live mode.
2. Obtain a sandbox restricted or secret key. A restricted key needs read/write
   access to Products, Prices, and Checkout Sessions. Keys must begin with
   `rk_test_` or `sk_test_`; this command rejects live and publishable keys.
3. Store it locally as `STRIPE_TEST_SECRET_KEY` in `packages/web/.env` using your
   editor or secret manager, or export it through your secret manager. `.env` is
   ignored by Git. Restrict its permissions to your user. Do not paste the value
   into chat, a command argument, or source control. Do not put sandbox credentials
   in the production Pages `STRIPE_SECRET_KEY` binding.

The operator command uses Node.js 24 or newer and the existing web dependencies.
Run it from `packages/web`:

```sh
npm run billing:test -- --help
npm run billing:test -- create \
  --return-url https://iscn-web.pages.dev/dashboard/billing \
  --attempt first-private-checkout
```

The command creates a labelled **CAD 1.00/month sandbox fixture** with Price
metadata `validations_per_month=100`, then creates a subscription-mode Checkout
Session for one unit. These are synthetic test values, not commercial pricing or
an API allowance granted to an account. The production price, currency, and
included usage are still undecided. The fixture does not test taxes, coupons, or
customer portal policies.

Each attempt name supplies separate Stripe idempotency keys for the Price and
Checkout Session. Retry a network failure with the same name and unchanged
arguments within 24 hours. Do not change the name merely to work around an unknown
result; check the sandbox request log first. Stripe can forget idempotency keys
after 24 hours, so inspect existing objects before retrying an older attempt.
Use a new name only for an intentional new test purchase.

## Exercise checkout

Open the returned `checkoutUrl` privately. Confirm Stripe identifies it as a test
checkout. Use a Stripe test card such as `4242 4242 4242 4242`, any future expiry,
and a test CVC. Use synthetic billing details; no real card is needed. A test
purchase does not move money. Both the success and cancel buttons return to the
chosen page; that redirect alone is not evidence of payment.

Inspect the returned session ID (replace the placeholder below):

```sh
npm run billing:test -- status --session cs_test_REPLACE
```

The result reports session status, payment status, and the test subscription ID.
For an ordinary successful card purchase, expect `status: "complete"` and
`paymentStatus: "paid"`. The command reads Stripe's status; it never marks a
production account paid. Test sessions and subscriptions carry
`metadata.iscn_private_test=true` and no application customer identifier.

An unused, open session can be closed:

```sh
npm run billing:test -- expire --session cs_test_REPLACE
```

Only a tagged ISCN test session can be inspected or expired by this tool. Expiring
an open checkout does not cancel a completed subscription. Cancel completed test
subscriptions in the same Stripe sandbox; archive unused test Prices/Products
there when finished. Repeating a completed checkout intentionally creates another
test subscription only with a new attempt.

## Before a customer launch

Keep `BILLING_CHECKOUT_ENABLED` unset or `false` in production. Do not connect this
sandbox's event destination to the production webhook. This private tool tests
Stripe's hosted subscription checkout and status, **not** the application webhook,
portal, account association, or paid API entitlement lifecycle. Those flows need
a separate staging deployment with its own D1 database and sandbox webhook before
launch; follow the [hosted API acceptance sequence](hosted-api.md#test-mode-launch-sequence).

After commercial terms and the full staging test are approved, configure the live
Price and live credentials in production and explicitly set
`BILLING_CHECKOUT_ENABLED=true`. Redeploy and verify the displayed price and
customer flow. Changing the launch switch is not part of this private setup.

References: [Stripe sandboxes and keys](https://docs.stripe.com/keys),
[test payment methods](https://docs.stripe.com/testing),
[Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create), and
[idempotent requests](https://docs.stripe.com/api/idempotent_requests).
