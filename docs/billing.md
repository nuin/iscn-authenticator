# ISCN Authenticator — Billing Guide

Plans, quotas, upgrading to Pro, and how Stripe fits into the flow.

## Plans

| Plan | Price | Monthly quota | Rate limit |
|------|-------|---------------|------------|
| Free | $0 | 10 000 requests / calendar month | 60 req/min (burst 120) |
| Pro | see `/dashboard/billing` | 1 000 000 requests / calendar month | 60 req/min (burst 120) |

Both plans share the same per-key rate limit. The plan determines the monthly cap only. Over-quota requests return `402 quota_exceeded`; we do not automatically bill overages.

## Signing up (Free)

```bash
curl -X POST https://iscn.example.com/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}'
```

The response contains your first API key (plaintext shown once). Your account starts on the Free plan with no card on file.

## Upgrading to Pro

1. Log in at `https://iscn.example.com/login` using the API key we issued at signup.
2. Navigate to the **Billing** tab.
3. Click **Upgrade to Pro**. You will be redirected to Stripe Checkout.
4. Enter your payment details. Stripe handles and stores card data; we never see it.
5. On successful checkout, Stripe redirects you back to the dashboard and sends us a `checkout.session.completed` webhook. Your account tier flips to `pro` within a few seconds.

Your monthly counter resets on the first day of the next UTC calendar month regardless of when you upgrade. Upgrading mid-month immediately raises your effective `limit`; the `used` counter is preserved.

## Managing your subscription

From the **Billing** tab, click **Manage subscription** to open the Stripe Billing Portal. From the portal you can:

- Update your card.
- Update your billing address.
- Cancel your subscription.
- Download invoices.

### Cancellation

Cancellation in the Stripe Billing Portal takes effect at the end of your current billing period. You remain on the Pro plan (and the Pro quota) until that date. Once the subscription ends, your tier reverts to Free.

### Payment failure

If a recurring payment fails, Stripe sends us an `invoice.payment_failed` event. We mark your account `past_due` and your effective quota drops to the Free-plan limit. Stripe will automatically retry the charge; once payment succeeds, your account returns to `active` and Pro quota.

## Usage reporting

Every authenticated response carries quota headers:

```
X-Monthly-Quota-Limit: 1000000
X-Monthly-Quota-Remaining: 995787
X-Monthly-Quota-Reset: 1746057600
```

For a structured snapshot:

```bash
curl -H "Authorization: Bearer $ISCN_API_KEY" \
  https://iscn.example.com/usage
```

Returns `{ customer_id, tier, month, used, limit, remaining, reset_at }`. This endpoint is read-only — polling it does not consume quota.

## Data we share with Stripe

| Field | Shared? | Notes |
|-------|---------|-------|
| Email | yes | Used as the Stripe customer email. |
| Company name | optional | Only if you enter it at Checkout. |
| Card details | yes | Entered directly into Stripe; we never see the card. |
| Usage data | no | Stripe does not receive per-request metadata or karyotype content. |
| Karyotype payloads | no | Never leave the validation service. |

Stripe is **not** a HIPAA business associate for this service. If your integration involves PHI, ensure that PHI never traverses the billing flow.

## Taxes

Tax handling is determined by Stripe Tax settings for your jurisdiction. Where we are required to collect tax, it is added at Checkout and itemized on your invoice.

## Changing plans, quotas, or pricing

Pricing may change; any change is announced at least 30 days in advance per the Terms of Service. Existing subscribers are not auto-migrated to a new price without an explicit renewal notice.

Need a higher quota than Pro, annual billing, or a custom plan? That is out of scope for self-serve billing in this release. Reach out via the contact shown in your dashboard.

## Troubleshooting

- **Checkout redirects back to the dashboard but my tier is still Free.** The webhook may not have reached us yet — refresh in a few seconds. If it does not update within a minute, contact support with the Stripe Checkout Session ID.
- **`402 quota_exceeded` immediately after upgrading.** Your tier flips on receipt of the webhook. If you were briefly over the Free-tier limit before upgrade, requests made during that window still return `402`; new requests post-upgrade should succeed.
- **Rotating my key lost my usage counter.** Usage is tracked per customer, not per key. Rotating a key preserves the counter.
- **I want to delete my account.** Cancel the Pro subscription in the Stripe Billing Portal first; then email support to have the customer record and all associated keys deleted.
