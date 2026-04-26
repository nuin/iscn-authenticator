/**
 * Minimal Stripe client for Cloudflare Workers.
 *
 * Cloudflare Pages/Workers don't run the official `stripe` Node SDK well
 * (Node-builtin shims, large bundle). We only need three calls and webhook
 * signature verification, so we go straight to the REST API with `fetch`
 * and use Web Crypto for HMAC.
 *
 * Exposed surface:
 *   - createCheckoutSession()          POST /v1/checkout/sessions
 *   - createBillingPortalSession()     POST /v1/billing_portal/sessions
 *   - verifyWebhookSignature()         constant-time HMAC-SHA256 check on
 *                                      `Stripe-Signature` header
 */

const STRIPE_API = 'https://api.stripe.com/v1';

interface StripeError {
  type: string;
  message: string;
  code?: string;
}

/** Form-encode a flat object the way Stripe expects. */
function formEncode(params: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) usp.set(k, v);
  }
  return usp.toString();
}

async function stripeFetch<T>(
  path: string,
  secretKey: string,
  body: Record<string, string | undefined>,
): Promise<T> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formEncode(body),
  });
  const json = (await res.json()) as { error?: StripeError } & T;
  if (!res.ok || (json as { error?: StripeError }).error) {
    const err = (json as { error?: StripeError }).error;
    throw new Error(
      `Stripe ${path} failed (${res.status}): ${err?.message ?? 'unknown error'}`,
    );
  }
  return json as T;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

/**
 * Create a Stripe Checkout Session for a Pro subscription.
 *
 * `clientReferenceId` must be the internal user id; the webhook reads
 * `metadata.customer_id` (which we set to the same value) to flip the
 * row in `user.plan` to 'pro'.
 */
export async function createCheckoutSession(
  secretKey: string,
  args: {
    priceId: string;
    customerEmail: string;
    customerId: string;
    successUrl: string;
    cancelUrl: string;
    stripeCustomerId?: string | null;
  },
): Promise<CheckoutSession> {
  const body: Record<string, string | undefined> = {
    mode: 'subscription',
    'line_items[0][price]': args.priceId,
    'line_items[0][quantity]': '1',
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    client_reference_id: args.customerId,
    'metadata[customer_id]': args.customerId,
    'subscription_data[metadata][customer_id]': args.customerId,
    allow_promotion_codes: 'true',
  };
  if (args.stripeCustomerId) {
    body.customer = args.stripeCustomerId;
  } else {
    body.customer_email = args.customerEmail;
  }
  return await stripeFetch<CheckoutSession>('/checkout/sessions', secretKey, body);
}

export interface BillingPortalSession {
  id: string;
  url: string;
}

/** Create a Billing Portal session so the customer can manage their plan. */
export async function createBillingPortalSession(
  secretKey: string,
  args: { stripeCustomerId: string; returnUrl: string },
): Promise<BillingPortalSession> {
  return await stripeFetch<BillingPortalSession>(
    '/billing_portal/sessions',
    secretKey,
    {
      customer: args.stripeCustomerId,
      return_url: args.returnUrl,
    },
  );
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

/**
 * Verify a `Stripe-Signature` header against the raw payload.
 *
 * Stripe sends `t=<unix_ts>,v1=<hex_hmac_sha256>[,v1=...]`. We compute
 * HMAC-SHA256 over `${t}.${payload}` with the endpoint secret and check
 * (in constant time) that at least one provided `v1` matches.
 *
 * `toleranceSeconds` rejects replays older than the threshold (default
 * 5 minutes, the Stripe library default).
 *
 * Returns the parsed event JSON on success; throws on any failure.
 */
export async function verifyWebhookSignature<T = unknown>(
  payload: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<T> {
  if (!signatureHeader) throw new Error('Missing Stripe-Signature header');
  if (!secret) throw new Error('Missing webhook secret');

  // Parse `t=...,v1=...,v1=...`
  let timestamp: number | null = null;
  const sigs: string[] = [];
  for (const part of signatureHeader.split(',')) {
    const [k, v] = part.split('=');
    if (k === 't' && v) timestamp = Number.parseInt(v, 10);
    else if (k === 'v1' && v) sigs.push(v);
  }
  if (timestamp === null || Number.isNaN(timestamp)) {
    throw new Error('Stripe-Signature missing t=<timestamp>');
  }
  if (sigs.length === 0) {
    throw new Error('Stripe-Signature missing v1=<hmac>');
  }
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    throw new Error('Stripe-Signature timestamp outside tolerance window');
  }

  const expected = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
  let ok = false;
  for (const sig of sigs) {
    if (constantTimeEqual(sig, expected)) ok = true;
  }
  if (!ok) throw new Error('Stripe-Signature did not match computed HMAC');

  return JSON.parse(payload) as T;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
