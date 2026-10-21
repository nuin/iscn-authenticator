import { accountMetadata, stripeId, stripeObject } from '#lib/server/stripe-events.js';
import { parseApiOffering, type ApiOffering } from '#lib/server/api-offering.js';
import { STRIPE_API, stripeHeaders } from '#lib/server/stripe-config.js';

export interface CurrentSubscription {
  id: string;
  userId: string | undefined;
  status: string;
  prices: string[];
  apiPeriods: { offering: ApiOffering; start: number; end: number }[];
}

function paidApiPeriods(subscription: Record<string, unknown>, items: unknown[]): CurrentSubscription['apiPeriods'] {
  if (subscription.status !== 'active' || subscription.pause_collection != null ||
      !subscription.latest_invoice || typeof subscription.latest_invoice !== 'object') return [];
  const invoice = stripeObject(subscription.latest_invoice);
  if (invoice.object !== 'invoice' || invoice.status !== 'paid') return [];
  return items.flatMap((value) => {
    const item = stripeObject(value);
    const offering = parseApiOffering(item.price);
    const start = item.current_period_start;
    const end = item.current_period_end;
    if (!offering || item.quantity !== 1 || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
        Number(start) < 0 || Number(end) <= Number(start)) return [];
    return [{ offering, start: Number(start), end: Number(end) }];
  });
}

function parseSubscription(value: unknown, customerId: string): CurrentSubscription {
  const subscription = stripeObject(value);
  const status = subscription.status;
  if (subscription.object !== 'subscription' || stripeId(subscription.customer, 'cus_') !== customerId ||
      typeof status !== 'string' || !['active', 'trialing', 'past_due', 'unpaid', 'canceled',
        'incomplete', 'incomplete_expired', 'paused'].includes(status)) {
    throw new Error('Invalid current subscription');
  }
  const items = stripeObject(subscription.items);
  if (!Array.isArray(items.data) || items.has_more !== false) {
    throw new Error('Incomplete subscription items');
  }
  return {
    id: stripeId(subscription.id, 'sub_'), userId: accountMetadata(subscription.metadata), status,
    prices: items.data.map((item) => stripeId(stripeObject(item).price, 'price_')),
    apiPeriods: paidApiPeriods(subscription, items.data),
  };
}

export async function listCurrentSubscriptions(secretKey: string, customerId: string): Promise<CurrentSubscription[]> {
  const query = new URLSearchParams({ customer: customerId, status: 'all', limit: '100' });
  query.append('expand[]', 'data.latest_invoice');
  const response = await fetch(`${STRIPE_API}/subscriptions?${query}`, {
    headers: stripeHeaders(secretKey), signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Stripe subscription lookup failed');
  const list = stripeObject(await response.json());
  if (list.object !== 'list' || !Array.isArray(list.data) || list.has_more !== false) {
    throw new Error('Incomplete subscription list');
  }
  return list.data.map((value) => parseSubscription(value, customerId));
}

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
      ...stripeHeaders(secretKey),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formEncode(body),
    signal: AbortSignal.timeout(10_000),
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
