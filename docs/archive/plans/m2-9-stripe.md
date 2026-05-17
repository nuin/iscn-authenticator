# M2/9 — Stripe Checkout + Webhook Integration

**Status:** spec (ready to implement)
**Branch:** `milestone-2-monetization`
**Predecessor:** M2/8 signup endpoint (commit `f3ea132`)
**Plan origin:** `~/.claude/plans/starry-scribbling-wave.md` § "M2/9 — Stripe integration"

This document is a self-contained implementation spec: exact interface
shapes, function signatures, route wiring, KV key layout, and test cases.
Anyone with repo access should be able to implement M2/9 from this doc
without re-reading the master plan.

---

## Objective

Wire a fetch-based Stripe client (no npm SDK) so that:

1. A signed-in Free-tier customer can click **Upgrade** on `/dashboard/billing`,
   land on Stripe Checkout, complete payment, and have their `CustomerRecord`
   flip to `tier: "pro"` via webhook.
2. A Pro customer can click **Manage billing** to reach Stripe's Billing
   Portal for plan changes / cancellation / payment-method updates.
3. Stripe webhooks (`checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.payment_failed`) drive all tier/status transitions
   idempotently.

No Stripe SDK dependency — we hit `https://api.stripe.com/v1/…` with
`fetch` and verify webhook signatures with `crypto.subtle` HMAC-SHA256.
This keeps the app npm-dep-free and Deno Deploy friendly.

---

## Commit boundary

One commit: `M2/9: Stripe checkout + webhook integration`.

Sub-steps 9a–9e are mental structure; they land in a single commit so the
whole integration is either present (types clean, tests green, all routes
wired) or absent (revert to `f3ea132` state). Splitting mid-integration
leaves dangling route handlers with no backing lib, which is worse than
one bigger commit.

---

## KV schema additions

```
subscriptions:<customer_id>   → SubscriptionRecord
stripe_events:<event_id>      → 1                         TTL 7 days (idempotency)
```

Nothing else changes. `CustomerRecord.stripe_customer_id`, `.tier`, and
`.status` already exist (M2/1); webhook handlers mutate them via the
existing `attachStripeCustomer`, `updateCustomerTier`, and
`updateCustomerStatus` helpers.

### SubscriptionRecord shape

```typescript
export interface SubscriptionRecord {
  customer_id: string;               // c_<hex>
  stripe_subscription_id: string;    // sub_...
  tier: "pro";                       // only pro lives in subscriptions
  current_period_start: string;      // ISO 8601
  current_period_end: string;        // ISO 8601
  cancel_at_period_end: boolean;
  updated_at: string;                // ISO 8601
}
```

---

## 9a — Config + errors

### `deno/lib/config.ts`

Add four fields. All four default to the empty string; empty string
means "Stripe disabled" and `/dashboard/billing/upgrade` returns
`BadRequestError("Stripe is not configured")`. Production deploys set
all four via env vars.

```typescript
// in Config interface
/** Stripe secret key. `sk_test_…` in dev, `sk_live_…` in prod. Empty disables billing. */
stripeSecretKey: string;
/** Webhook signing secret from Stripe CLI / dashboard. Empty disables webhook verification. */
stripeWebhookSecret: string;
/** Price ID for the Pro tier recurring subscription. */
stripePriceIdPro: string;
/** Public origin of this deployment (e.g. "https://iscn.example.com"). Used for Stripe return URLs. */
publicBaseUrl: string;
```

Add to `DEFAULTS`:

```typescript
stripeSecretKey: "",
stripeWebhookSecret: "",
stripePriceIdPro: "",
publicBaseUrl: "",
```

Add to `loadConfig()`:

```typescript
stripeSecretKey: Deno.env.get("STRIPE_SECRET_KEY") ?? DEFAULTS.stripeSecretKey,
stripeWebhookSecret: Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? DEFAULTS.stripeWebhookSecret,
stripePriceIdPro: Deno.env.get("STRIPE_PRICE_ID_PRO") ?? DEFAULTS.stripePriceIdPro,
publicBaseUrl: Deno.env.get("PUBLIC_BASE_URL") ?? DEFAULTS.publicBaseUrl,
```

`defaultConfig()` test helper: leave all four blank (tests override what
they need).

### `deno/lib/errors.ts`

Add `"stripe_error"` to the `ErrorCode` union, and a class:

```typescript
/**
 * Webhook signature invalid, payload malformed, or event unhandleable.
 * 400 is correct per Stripe's own recommendation — Stripe retries on 5xx
 * but not on 4xx, and we don't want to drive retries from malformed input.
 */
export class StripeWebhookError extends AppError {
  constructor(message = "Invalid Stripe webhook") {
    super("stripe_error", 400, message);
  }
}
```

No other error-mapping changes. `errorToResponse()` already handles any
`AppError` subclass.

---

## 9b — `deno/lib/stripe.ts`

Thin HTTP client. ~180 lines total. No npm deps. All request bodies are
`application/x-www-form-urlencoded` (Stripe's native format — no JSON).

### Public surface

```typescript
import type { Config } from "./config.ts";

export interface CheckoutSessionArgs {
  customerId: string;            // our c_<hex>
  customerEmail: string;         // prefill Stripe Checkout
  stripeCustomerId: string | null; // if we already created one via previous checkout
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  id: string;                    // cs_…
  url: string;                   // redirect target
}

export interface PortalSessionResult {
  id: string;                    // bps_…
  url: string;
}

export interface StripeEvent {
  id: string;                    // evt_…
  type: string;                  // e.g. "checkout.session.completed"
  data: { object: Record<string, unknown> };
  created: number;
  livemode: boolean;
}

export async function createCheckoutSession(
  config: Config,
  args: CheckoutSessionArgs,
): Promise<CheckoutSessionResult>;

export async function createBillingPortalSession(
  config: Config,
  stripeCustomerId: string,
  returnUrl: string,
): Promise<PortalSessionResult>;

/**
 * Verify Stripe-Signature header against raw request body.
 * Throws StripeWebhookError on mismatch, stale timestamp, or malformed header.
 * `nowSeconds` is injectable for tests; defaults to Date.now() / 1000.
 * `toleranceSeconds` defaults to 300 (5 min, Stripe's recommended window).
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowSeconds?: number,
  toleranceSeconds?: number,
): Promise<void>;

/**
 * Parse a verified raw body into a StripeEvent. Throws StripeWebhookError
 * if the payload is not a valid Stripe event shape.
 */
export function constructEvent(rawBody: string): StripeEvent;
```

### Implementation notes

**Auth.** Every outbound call sends
`Authorization: Basic <base64(secretKey + ":")>`. Stripe accepts Bearer
too, but Basic is the documented default and works with every test tool.

**Form encoding.** Stripe uses nested bracket notation
(`line_items[0][price]=price_…&line_items[0][quantity]=1`). Write a
private helper:

```typescript
function formEncode(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === null || v === undefined) continue;
    if (typeof v === "object" && !Array.isArray(v)) {
      parts.push(formEncode(v as Record<string, unknown>, key));
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === "object" && item !== null) {
          parts.push(formEncode(item as Record<string, unknown>, `${key}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.filter(Boolean).join("&");
}
```

**`createCheckoutSession` body:**

```typescript
{
  mode: "subscription",
  "line_items[0][price]": args.priceId,
  "line_items[0][quantity]": 1,
  success_url: args.successUrl,
  cancel_url: args.cancelUrl,
  client_reference_id: args.customerId,         // ← carries our c_<hex> through Stripe
  "metadata[customer_id]": args.customerId,     // ← redundant safety net on the session itself
  // Either set customer OR customer_email, not both:
  ...(args.stripeCustomerId
    ? { customer: args.stripeCustomerId }
    : { customer_email: args.customerEmail }),
  "subscription_data[metadata][customer_id]": args.customerId, // ← metadata on the *subscription*
}
```

The triple-metadata redundancy is deliberate: webhook payloads sometimes
only include the subscription object (not the session), and we need to
recover our customer id from every event type.

**Error handling.** On non-2xx Stripe responses, read the JSON error
envelope and throw a plain `Error` with Stripe's `error.message`. The
caller (`handleDashboardRoute`) catches and maps it to
`BadRequestError("Billing temporarily unavailable")` — don't leak Stripe
internals to browsers.

**`verifyWebhookSignature` algorithm:**

1. Parse header `t=<unix>,v1=<hex>,v1=<hex>,…` (Stripe may include
   multiple `v1` entries during key rotation). Header absent or
   malformed → `StripeWebhookError`.
2. Reject if `|now - t| > tolerance` (replay protection).
3. Compute `expected = hmacSha256Hex(secret, `${t}.${rawBody}`)`.
4. `timingSafeEqualHex` each `v1` value against `expected`. Any match → ok.
5. No match → `StripeWebhookError("Signature mismatch")`.

HMAC helper mirrors the private one in `sessions.ts`:

```typescript
async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

`timingSafeEqualHex` is copy-paste from `sessions.ts` (or promote it to
a shared `lib/crypto_utils.ts` — see "Open question" below).

---

## 9c — `deno/lib/webhooks.ts`

Event dispatcher. Pure function of `(kv, event) → Promise<void>`.
Idempotency check happens in the route handler, not here — this module
assumes every call is a fresh event it has not yet processed.

### Public surface

```typescript
import type { StripeEvent } from "./stripe.ts";

export interface SubscriptionRecord {
  customer_id: string;
  stripe_subscription_id: string;
  tier: "pro";
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  updated_at: string;
}

export async function saveSubscription(
  kv: Deno.Kv,
  record: SubscriptionRecord,
): Promise<void>;

export async function lookupSubscription(
  kv: Deno.Kv,
  customerId: string,
): Promise<SubscriptionRecord | null>;

/**
 * Dispatch a verified Stripe event. Throws StripeWebhookError when the
 * event references a customer id we do not recognise, or when required
 * fields are missing. Returns silently on unknown event.type (we 200
 * those so Stripe doesn't retry forever).
 */
export async function handleStripeEvent(
  kv: Deno.Kv,
  event: StripeEvent,
  now?: () => number,
): Promise<void>;
```

### Event handlers

**`checkout.session.completed`:**
- `session = event.data.object`
- `customerId = session.client_reference_id ?? session.metadata?.customer_id`.
  Missing → `StripeWebhookError("customer_id not on session")`.
- Verify the `CustomerRecord` exists — missing → `StripeWebhookError`
  (do not silently create; an orphaned Stripe customer indicates a bug).
- `attachStripeCustomer(kv, customerId, session.customer)` (type: string).
- `updateCustomerTier(kv, customerId, "pro")`.
- `updateCustomerStatus(kv, customerId, "active")`.
- If `session.subscription` is present (string sub id), **also** fetch it
  back via Stripe API to populate `SubscriptionRecord`. Simpler
  alternative: wait for the follow-on `customer.subscription.updated`
  event (Stripe always fires both on a fresh checkout). **Pick the
  wait-and-let-the-next-event-populate approach** — one fewer outbound
  call, and the subscription event carries all needed fields natively.

**`customer.subscription.updated`:**
- `sub = event.data.object`
- `customerId = sub.metadata?.customer_id`. Missing → look up by
  `sub.customer` (Stripe customer id) against all our `CustomerRecord`s
  with matching `stripe_customer_id`. If still not found →
  `StripeWebhookError`.

  *Implementation shortcut:* add `customers_by_stripe:<stripe_customer_id>`
  reverse-index populated inside `attachStripeCustomer`. Cheap, avoids a
  full-table scan. One extra atomic write per checkout completion.
- Persist `SubscriptionRecord` via `saveSubscription`.
- Derive status:
  - `sub.status === "active"` or `"trialing"` → `status: "active"`, `tier: "pro"`.
  - `sub.status === "past_due"` → `status: "past_due"`, `tier: "pro"`
    (grace period — they still get Pro quota until
    `invoice.payment_failed` forces downgrade, matching Stripe's dunning).
  - `sub.status === "canceled"` or `"unpaid"` → `status: "cancelled"`,
    `tier: "free"`.

**`customer.subscription.deleted`:**
- Look up customer via `sub.metadata.customer_id` or reverse index.
- `updateCustomerTier(kv, id, "free")`.
- `updateCustomerStatus(kv, id, "cancelled")`.
- Delete the `subscriptions:<customer_id>` row (optional — leaving a
  stale one is harmless because tier is the source of truth).

**`invoice.payment_failed`:**
- `invoice = event.data.object`
- Look up customer via `invoice.customer` (stripe id) → reverse index.
- `updateCustomerStatus(kv, id, "past_due")`. Do **not** downgrade tier
  yet; Stripe Smart Retries may still succeed. Tier downgrade follows
  the eventual `customer.subscription.deleted` or
  `customer.subscription.updated` with `status: "canceled"`.

**Unknown event.type:** log a warning, return. Do not throw — Stripe
retries 4xx/5xx and we'd generate infinite noise on every new event
Stripe adds upstream.

### Idempotency contract (implemented in route handler, not here)

```
key = ["stripe_events", event.id]
atomic check(key, null) → set(key, 1, { expireIn: 7d })
```

If CAS fails, we've already processed this event; return 200 without
calling `handleStripeEvent` again. If CAS succeeds, call the handler;
if the handler throws, the idempotency mark still stands — preferable to
Stripe retrying forever on a persistent server-side bug. (Alternate
design: only mark after success. Discussed and rejected: makes a bad
handler DoS itself with unbounded retry traffic.)

---

## 9d — Route wiring

### `deno/lib/dashboard.ts`

Replace `renderBillingBody(customer)` placeholder with the real UI. Add
two POST handlers inside `handleDashboardRoute`'s session-authenticated
tree.

**New billing UI logic:**

```typescript
export function renderBillingBody(
  customer: CustomerRecord,
  config: Config,
  subscription: SubscriptionRecord | null,
): string {
  const configured = config.stripeSecretKey !== "" && config.stripePriceIdPro !== "";
  if (!configured) {
    return `<h2>Billing</h2>
      <p class="muted">Billing is not configured on this deployment.</p>`;
  }
  if (customer.tier === "free") {
    return `<h2>Billing</h2>
      <p>You are on the <strong>Free</strong> plan (${config.monthlyQuotaFree.toLocaleString()} requests/month).</p>
      <form method="POST" action="/dashboard/billing/upgrade">
        <button type="submit" class="primary">Upgrade to Pro</button>
      </form>
      <p class="muted">You'll be redirected to Stripe to complete payment.</p>`;
  }
  // Pro
  const renews = subscription?.current_period_end ?? "unknown";
  const cancelling = subscription?.cancel_at_period_end ?? false;
  return `<h2>Billing</h2>
    <p>You are on the <strong>Pro</strong> plan
      (${config.monthlyQuotaPro.toLocaleString()} requests/month).</p>
    <p>Status: <strong>${escapeHtml(customer.status)}</strong>.
      ${cancelling ? `Cancels at ${escapeHtml(renews)}.` : `Renews ${escapeHtml(renews)}.`}</p>
    <form method="POST" action="/dashboard/billing/manage">
      <button type="submit">Manage billing</button>
    </form>`;
}
```

**Dispatcher additions** (inside the session-authenticated branch of
`handleDashboardRoute`):

```typescript
if (method === "POST" && path === "/dashboard/billing/upgrade") {
  if (customer.tier !== "free") {
    return redirect303("/dashboard/billing"); // idempotent no-op
  }
  if (config.stripeSecretKey === "" || config.stripePriceIdPro === "") {
    throw new BadRequestError("Billing is not configured");
  }
  const base = config.publicBaseUrl || `${url.protocol}//${url.host}`;
  const session = await createCheckoutSession(config, {
    customerId: customer.id,
    customerEmail: customer.email,
    stripeCustomerId: customer.stripe_customer_id,
    priceId: config.stripePriceIdPro,
    successUrl: `${base}/dashboard/billing?checkout=success`,
    cancelUrl: `${base}/dashboard/billing?checkout=cancelled`,
  });
  return redirect303(session.url);
}

if (method === "POST" && path === "/dashboard/billing/manage") {
  if (!customer.stripe_customer_id) {
    throw new BadRequestError("No Stripe customer on record");
  }
  const base = config.publicBaseUrl || `${url.protocol}//${url.host}`;
  const portal = await createBillingPortalSession(
    config,
    customer.stripe_customer_id,
    `${base}/dashboard/billing`,
  );
  return redirect303(portal.url);
}
```

`redirect303(location)` is a one-liner helper returning
`new Response(null, { status: 303, headers: { Location: location } })`.

Update `renderDashboard`'s call site to pass `config` and the
subscription lookup result.

### `deno/lib/middleware.ts`

Add a single new route branch **before** the dashboard branch (dashboard
catches any `/dashboard/…` prefix and we want the webhook to be a
top-level path):

```typescript
if (path === "/billing/webhook") {
  response = await handleStripeWebhook(req, { kv, config });
}
```

And the new handler (placed at bottom of `middleware.ts` or moved into
`webhooks.ts` — see Open question #2):

```typescript
async function handleStripeWebhook(
  req: Request,
  ctx: { kv: Deno.Kv; config: Config },
): Promise<Response> {
  if (req.method !== "POST") {
    throw new MethodNotAllowedError(["POST"]);
  }
  if (ctx.config.stripeWebhookSecret === "") {
    throw new StripeWebhookError("Webhook secret not configured");
  }
  // CRITICAL: read raw body BEFORE any JSON parsing. HMAC is over the
  // exact bytes Stripe sent; reparsing would normalise whitespace.
  const rawBody = await req.text();
  const sigHeader = req.headers.get("stripe-signature");
  await verifyWebhookSignature(rawBody, sigHeader, ctx.config.stripeWebhookSecret);
  const event = constructEvent(rawBody);

  // Idempotency CAS.
  const idemKey = ["stripe_events", event.id];
  const cas = await ctx.kv.atomic()
    .check({ key: idemKey, versionstamp: null })
    .set(idemKey, 1, { expireIn: 7 * 24 * 60 * 60 * 1000 })
    .commit();
  if (!cas.ok) {
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  }

  await handleStripeEvent(ctx.kv, event);
  return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
}
```

**Do not** run the webhook through the main CORS / rate-limit / auth
pipeline — it bypasses all of them by virtue of being handled in its own
branch before any of those middleware steps. This is deliberate: rate
limiting Stripe would cause us to drop legitimate events, and auth is
done via signature not API key.

### `deno/deno.json`

Add `lib/stripe.ts` and `lib/webhooks.ts` to the `check` task file list.

### `deno/main.ts` (Deno Deploy entrypoint)

The inlined dashboard HTML lives here for Deploy parity. Update the
billing tab fragment to match `renderBillingBody`'s output. Keep the
embedded version in sync with `deno/lib/dashboard.ts` — same drift risk
as every other template we duplicate for Deploy.

---

## 9e — Tests

`deno/tests/stripe_test.ts`. Target: 18–22 new tests. Suite should stay
green at 228–232 total.

### Signature verification

```
"verifyWebhookSignature: valid signature passes"
"verifyWebhookSignature: valid signature with multiple v1 entries passes"
"verifyWebhookSignature: missing header → StripeWebhookError"
"verifyWebhookSignature: malformed header (no t=) → StripeWebhookError"
"verifyWebhookSignature: stale timestamp (> tolerance) → StripeWebhookError"
"verifyWebhookSignature: future timestamp beyond tolerance → StripeWebhookError"
"verifyWebhookSignature: wrong secret → StripeWebhookError"
"verifyWebhookSignature: tampered payload → StripeWebhookError"
```

Use deterministic timestamps and a fixed fake secret; compute the
expected signature in the test using the same HMAC helper.

### Event dispatch

All tests seed a customer via `createCustomer`, synthesise the event
object by hand (no real Stripe calls), and assert post-state.

```
"checkout.session.completed: sets tier=pro, status=active, attaches stripe_customer_id"
"checkout.session.completed: unknown customer_id → StripeWebhookError"
"customer.subscription.updated (active): persists SubscriptionRecord, tier=pro"
"customer.subscription.updated (past_due): status=past_due, tier stays pro"
"customer.subscription.updated (canceled): tier=free, status=cancelled"
"customer.subscription.deleted: tier=free, status=cancelled"
"invoice.payment_failed: status=past_due, tier stays pro"
"unknown event.type: returns silently, no state change"
```

### Idempotency (at route level)

```
"POST /billing/webhook: replayed event is a no-op (tier stays pro after second call)"
```

Set up by invoking the route handler twice with the same event id and a
handler that would otherwise mutate state the second time.

### Checkout / portal session builders

Use `globalThis.fetch` swap to capture the outbound request and assert
body encoding. Restore the original `fetch` in a `try/finally` so test
isolation holds.

```
"createCheckoutSession: POSTs correct form body to /v1/checkout/sessions"
"createCheckoutSession: uses customer_email when stripe_customer_id is null"
"createCheckoutSession: uses customer when stripe_customer_id is set"
"createBillingPortalSession: POSTs correct body to /v1/billing_portal/sessions"
"createCheckoutSession: Stripe error response → throws with error.message"
```

### Route integration

```
"POST /dashboard/billing/upgrade (session, free tier): 303 to checkout URL"
"POST /dashboard/billing/upgrade (session, pro tier): 303 to /dashboard/billing (idempotent)"
"POST /dashboard/billing/upgrade (unconfigured): BadRequestError"
"POST /dashboard/billing/manage (session, pro tier): 303 to portal URL"
"POST /dashboard/billing/manage (session, no stripe_customer_id): BadRequestError"
```

Use the same session-cookie bootstrap pattern the existing dashboard
tests use (create session via `createSession`, attach cookie via
`SESSION_COOKIE_NAME`).

---

## Verification checklist (end of M2/9)

```bash
cd deno
deno task check        # types clean
deno task test         # all passing, +18–22 new
deno task lint         # no new warnings
deno fmt               # no diff
```

Then commit:

```
M2/9: Stripe checkout + webhook integration

Add fetch-based Stripe client (no npm SDK). Introduce
SubscriptionRecord KV schema, webhook event dispatch, and
idempotency guard via stripe_events:<event_id>.

Dashboard billing tab: free tier shows Upgrade button → Stripe
Checkout; pro tier shows Manage billing button → Stripe Billing
Portal. Webhook endpoint POST /billing/webhook bypasses the main
auth/rate-limit pipeline and authenticates via HMAC-SHA256
signature verification.

Config: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
STRIPE_PRICE_ID_PRO, PUBLIC_BASE_URL. All default to empty string;
empty disables billing UI cleanly.

New errors: StripeWebhookError (400, stripe_error).

New KV keys:
- subscriptions:<customer_id> → SubscriptionRecord
- stripe_events:<event_id> → 1 (TTL 7d idempotency)
- customers_by_stripe:<stripe_customer_id> → <customer_id> (reverse index)
```

---

## Risks / open questions

1. **HMAC helper duplication.** `sessions.ts` already has private
   `signHmacHex` and `timingSafeEqualHex`. `stripe.ts` needs the same.
   Option A: copy-paste (simpler diff, no refactor of M2/6 code).
   Option B: promote to `lib/crypto_utils.ts`, update `sessions.ts`
   imports. **Recommendation: A for M2/9**, refactor as a follow-up
   commit if the duplication ever grows to a third consumer.

2. **Where `handleStripeWebhook` lives.** Placing it in `middleware.ts`
   is fine but arguably it belongs in `webhooks.ts` alongside
   `handleStripeEvent`. **Recommendation: `webhooks.ts`**, since
   `middleware.ts` is already 400+ lines and the webhook route is
   conceptually paired with its dispatcher.

3. **Stripe API version pinning.** The `/v1/` endpoints are versioned
   via a `Stripe-Version` header. If we omit it, Stripe uses the
   account's default version — fine for dev but potentially
   non-deterministic. **Recommendation:** omit for M2/9, revisit if we
   ever see webhook payload-shape drift in production.

4. **Reverse index backfill.** The
   `customers_by_stripe:<stripe_customer_id>` reverse index must be
   populated in `attachStripeCustomer`. M2/1's implementation of that
   helper doesn't do it. This is a one-line addition: after the atomic
   write succeeds, also `kv.set(["customers_by_stripe", stripeCustomerId], customerId)`.
   No migration needed because no existing records have
   `stripe_customer_id` set yet.

5. **Checkout cancellation URL.** `?checkout=cancelled` query param is
   cosmetic — the billing page doesn't currently render a toast. A
   post-M2/9 follow-up can add "Checkout cancelled — you're still on
   Free" messaging if the param is present.

6. **Webhook replay window.** 7-day TTL on `stripe_events` matches
   Stripe's retry window (up to 3 days). Extra headroom for operator
   comfort. Shortening to 24h would reduce KV usage but risk
   reprocessing during a long Stripe-side incident.

---

## Non-goals

- Trial periods (Stripe supports `subscription_data.trial_period_days`
  but Pro tier goes straight to paid in M2).
- Proration on plan changes (we only have one paid tier; portal handles
  cancellations natively).
- Metered billing (quota is enforced locally; we never report usage
  records to Stripe).
- Tax / VAT collection (Stripe Tax disabled at account level; revisit
  for EU sales).
- Stripe Connect (not a multi-tenant marketplace).
- Annual billing (one monthly price only; add a second price_id env
  var post-M2 if we introduce annual).
