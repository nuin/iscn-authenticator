/**
 * Stripe HTTP client — thin wrapper around Stripe's REST API using
 * `fetch`. No npm SDK dependency (keeps the app Deno Deploy-friendly).
 *
 * Scope: enough for M2/9 (Checkout Sessions, Billing Portal Sessions,
 * webhook signature verification, event parsing). Everything else is
 * out of scope — the surface area of Stripe's full API is huge and we
 * only touch the subscription lifecycle bits we actually use.
 *
 * Auth: `Authorization: Basic <base64(secretKey + ":")>`.
 *   Stripe accepts `Bearer` too but documents Basic first, and it works
 *   with every HTTP test tool (curl, Postman, Deno) without headers
 *   toggles.
 *
 * Body format: Stripe's REST API does NOT accept JSON — it wants
 *   `application/x-www-form-urlencoded` with bracket notation for
 *   nested fields (e.g. `line_items[0][price]=price_...`). `formEncode`
 *   handles the nesting recursively.
 *
 * Webhook verification: HMAC-SHA256 of `${timestamp}.${rawBody}` against
 *   the webhook secret. Stripe sends the signature in the
 *   `Stripe-Signature` header as `t=<unix>,v1=<hex>[,v1=<hex>...]`.
 *   During key rotation Stripe may include multiple `v1` values; we
 *   accept the request if ANY of them match, timing-safe.
 */

import type { Config } from "./config.ts";
import { StripeWebhookError } from "./errors.ts";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
/** Default replay-protection window — Stripe's recommended value. */
const DEFAULT_TOLERANCE_SECONDS = 300;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CheckoutSessionArgs {
  /** Our opaque customer id (`c_<hex>`). Carried as `client_reference_id` + metadata. */
  customerId: string;
  /** Email to prefill on the Stripe-hosted form (used when stripeCustomerId is null). */
  customerEmail: string;
  /** Existing Stripe customer id (`cus_...`), if the caller already attached one. */
  stripeCustomerId: string | null;
  /** Price id for the subscription line item (`price_...`). */
  priceId: string;
  /** Absolute URL Stripe redirects to on successful payment. */
  successUrl: string;
  /** Absolute URL Stripe redirects to on cancel / back button. */
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  /** Checkout session id (`cs_...`). */
  id: string;
  /** Redirect target for the browser. */
  url: string;
}

export interface PortalSessionResult {
  /** Billing portal session id (`bps_...`). */
  id: string;
  /** Redirect target for the browser. */
  url: string;
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
  created: number;
  livemode: boolean;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

/**
 * Create a Stripe Checkout Session in `subscription` mode and return
 * `{ id, url }`. The customer id is propagated three ways
 * (`client_reference_id`, `metadata.customer_id`,
 * `subscription_data.metadata.customer_id`) so every downstream webhook
 * payload shape can recover our internal id.
 */
export async function createCheckoutSession(
  config: Config,
  args: CheckoutSessionArgs,
): Promise<CheckoutSessionResult> {
  const body: Record<string, unknown> = {
    mode: "subscription",
    line_items: [{ price: args.priceId, quantity: 1 }],
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    client_reference_id: args.customerId,
    metadata: { customer_id: args.customerId },
    subscription_data: { metadata: { customer_id: args.customerId } },
  };
  // Stripe rejects setting both customer and customer_email on the same
  // request. Prefer the pre-existing Stripe customer id when we have it.
  if (args.stripeCustomerId) {
    body.customer = args.stripeCustomerId;
  } else {
    body.customer_email = args.customerEmail;
  }
  const res = await stripePost(config, "/checkout/sessions", body);
  return { id: String(res.id), url: String(res.url) };
}

/**
 * Create a Billing Portal session that lets the customer manage their
 * subscription (cancel, update payment method, download invoices) on
 * Stripe's hosted UI.
 */
export async function createBillingPortalSession(
  config: Config,
  stripeCustomerId: string,
  returnUrl: string,
): Promise<PortalSessionResult> {
  const res = await stripePost(config, "/billing_portal/sessions", {
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
  return { id: String(res.id), url: String(res.url) };
}

/**
 * Fetch a Stripe Subscription by id. Used on `checkout.session.completed`
 * if we ever need period bounds before the follow-on
 * `customer.subscription.updated` event arrives — currently unused but
 * exposed for completeness.
 */
export async function retrieveSubscription(
  config: Config,
  subscriptionId: string,
): Promise<Record<string, unknown>> {
  return await stripeGet(config, `/subscriptions/${subscriptionId}`);
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verify a Stripe webhook signature header against the raw request body.
 * Throws `StripeWebhookError` on any failure (missing header, malformed
 * header, stale timestamp outside the tolerance window, or no matching
 * `v1=` hex digest).
 *
 * @param rawBody           Raw request body as sent by Stripe (do NOT
 *                          re-encode / re-parse before passing in).
 * @param signatureHeader   Value of the `Stripe-Signature` header.
 * @param secret            `STRIPE_WEBHOOK_SECRET` (`whsec_...`).
 * @param nowSeconds        Injectable clock (test hook); defaults to wall time.
 * @param toleranceSeconds  Replay protection window, default 300s.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS,
): Promise<void> {
  if (!secret) {
    throw new StripeWebhookError("Webhook secret not configured");
  }
  if (!signatureHeader) {
    throw new StripeWebhookError("Missing Stripe-Signature header");
  }
  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    throw new StripeWebhookError("Timestamp outside tolerance");
  }
  const expected = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  for (const sig of signatures) {
    if (timingSafeEqualHex(expected, sig)) return;
  }
  throw new StripeWebhookError("Signature mismatch");
}

/**
 * Parse a verified raw body into a `StripeEvent`. Throws
 * `StripeWebhookError` if the payload is not a syntactically valid
 * Stripe event. Verification MUST happen first — this function assumes
 * the bytes are trustworthy.
 */
export function constructEvent(rawBody: string): StripeEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new StripeWebhookError("Malformed event JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new StripeWebhookError("Event payload is not an object");
  }
  const ev = parsed as Record<string, unknown>;
  if (
    typeof ev.id !== "string" ||
    typeof ev.type !== "string" ||
    typeof ev.created !== "number" ||
    typeof ev.livemode !== "boolean"
  ) {
    throw new StripeWebhookError("Event missing required fields");
  }
  const data = ev.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== "object" || typeof data.object !== "object") {
    throw new StripeWebhookError("Event missing data.object");
  }
  return {
    id: ev.id,
    type: ev.type,
    data: { object: data.object as Record<string, unknown> },
    created: ev.created,
    livemode: ev.livemode,
  };
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface StripeResponse extends Record<string, unknown> {
  id?: unknown;
  url?: unknown;
}

async function stripePost(
  config: Config,
  path: string,
  body: Record<string, unknown>,
): Promise<StripeResponse> {
  if (!config.stripeSecretKey) {
    throw new Error("Stripe secret key not configured");
  }
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${config.stripeSecretKey}:`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formEncode(body),
  });
  return await readStripeResponse(res);
}

async function stripeGet(
  config: Config,
  path: string,
): Promise<StripeResponse> {
  if (!config.stripeSecretKey) {
    throw new Error("Stripe secret key not configured");
  }
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: "Basic " + btoa(`${config.stripeSecretKey}:`),
    },
  });
  return await readStripeResponse(res);
}

async function readStripeResponse(res: Response): Promise<StripeResponse> {
  const text = await res.text();
  if (!res.ok) {
    // Stripe returns `{ error: { message, type, code, ... } }`. We log
    // the status + short message but do NOT propagate Stripe internals
    // to the browser — the caller catches and surfaces a generic 4xx.
    let detail = text;
    try {
      const j = JSON.parse(text) as { error?: { message?: string } };
      if (j.error?.message) detail = j.error.message;
    } catch {
      // leave `detail` as the raw body text
    }
    throw new Error(`Stripe ${res.status}: ${detail}`);
  }
  try {
    return JSON.parse(text) as StripeResponse;
  } catch {
    throw new Error("Stripe returned non-JSON on 2xx");
  }
}

/**
 * Encode a JS object into Stripe's x-www-form-urlencoded format with
 * bracket notation for nested keys.
 *
 *   { line_items: [{ price: "p", quantity: 1 }] }
 *     → line_items[0][price]=p&line_items[0][quantity]=1
 */
export function formEncode(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === "object") {
          parts.push(formEncode(item as Record<string, unknown>, `${key}[${i}]`));
        } else {
          parts.push(
            `${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`,
          );
        }
      });
    } else if (typeof v === "object") {
      parts.push(formEncode(v as Record<string, unknown>, key));
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.filter((p) => p.length > 0).join("&");
}

interface ParsedSignatureHeader {
  timestamp: number;
  signatures: string[]; // hex, possibly multiple during key rotation
}

function parseSignatureHeader(header: string): ParsedSignatureHeader {
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === "t") {
      const ts = Number.parseInt(v, 10);
      if (!Number.isFinite(ts)) {
        throw new StripeWebhookError("Invalid signature timestamp");
      }
      timestamp = ts;
    } else if (k === "v1") {
      signatures.push(v);
    }
    // Ignore other scheme versions (v0, etc.) — Stripe only uses v1 at
    // present and forwards-compatibility isn't worth unverified parsing.
  }
  if (timestamp === null) {
    throw new StripeWebhookError("Missing timestamp in signature header");
  }
  if (signatures.length === 0) {
    throw new StripeWebhookError("No v1 signatures in header");
  }
  return { timestamp, signatures };
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time hex equality — avoid leaking the first mismatch position. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
