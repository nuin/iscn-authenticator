/**
 * Session authentication and customer-scoped dashboard controllers.
 * Session cookies use SameSite=Lax; writes require POST and an authenticated
 * session. Internal keys without a customer cannot create dashboard sessions.
 */
import type { Config } from "./config.ts";
import { authenticateSession } from "./auth.ts";
import {
  BadRequestError,
  MethodNotAllowedError,
  NotFoundError,
  UnauthenticatedError,
} from "./errors.ts";
import {
  type ApiKeyRecord,
  listKeysByCustomer,
  lookupKeyByPlaintext,
  revokeKey,
  rotateKey,
} from "./keys.ts";
import { type CustomerRecord, lookupCustomerById } from "./customers.ts";
import { createBillingPortalSession, createCheckoutSession } from "./stripe.ts";
import { lookupSubscription } from "./webhooks.ts";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  validateSessionFromRequest,
} from "./sessions.ts";
import type { SessionRecord } from "./sessions.ts";
import {
  renderBillingBody,
  renderDashboardLayout,
  renderKeysBody,
  renderLoginPage,
  renderOverviewBody,
} from "./dashboard_views.ts";
import { renderBatchBody } from "./dashboard_batch.ts";
import { currentMonthYYYYMM, peekUsage, quotaFor } from "./quota.ts";

export interface DashboardCtx {
  kv: Deno.Kv;
  config: Config;
  /** Test hook: clock for deterministic usage/session windows. */
  now?: () => Date;
}

export function isDashboardPath(path: string): boolean {
  if (path === "/login" || path === "/logout") return true;
  if (path === "/dashboard") return true;
  if (path.startsWith("/dashboard/")) return true;
  return false;
}

export async function handleDashboardRoute(
  req: Request,
  ctx: DashboardCtx,
): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/login") {
    if (req.method === "GET") return handleLoginGet();
    if (req.method === "POST") return await handleLoginPost(req, ctx);
    throw new MethodNotAllowedError(["GET", "POST"]);
  }
  if (path === "/logout") {
    if (req.method !== "POST") throw new MethodNotAllowedError(["POST"]);
    return await handleLogout(req, ctx);
  }

  // Everything below here requires a session.
  const session = await authenticateSession(req, ctx.kv, ctx.config.sessionSecret);
  const customer = await lookupCustomerById(ctx.kv, session.customer_id);
  if (customer === null) {
    // The session points at a deleted customer. Destroy the stale session
    // so the user gets a clean re-login instead of a confusing 401 loop.
    await destroySession(ctx.kv, session.id);
    throw new UnauthenticatedError();
  }

  if (path === "/dashboard") {
    if (req.method !== "GET") throw new MethodNotAllowedError(["GET"]);
    return await handleDashboardOverview(ctx, customer);
  }
  if (path === "/dashboard/keys") {
    if (req.method !== "GET") throw new MethodNotAllowedError(["GET"]);
    return await handleDashboardKeys(ctx, customer);
  }
  if (path === "/dashboard/keys/rotate") {
    if (req.method !== "POST") throw new MethodNotAllowedError(["POST"]);
    return await handleDashboardKeysRotate(req, ctx, customer);
  }
  if (path === "/dashboard/keys/revoke") {
    if (req.method !== "POST") throw new MethodNotAllowedError(["POST"]);
    return await handleDashboardKeysRevoke(req, ctx, customer);
  }
  if (path === "/dashboard/billing") {
    if (req.method !== "GET") throw new MethodNotAllowedError(["GET"]);
    return await handleDashboardBilling(ctx, customer);
  }
  if (path === "/dashboard/billing/upgrade") {
    if (req.method !== "POST") throw new MethodNotAllowedError(["POST"]);
    return await handleDashboardBillingUpgrade(ctx, customer);
  }
  if (path === "/dashboard/billing/manage") {
    if (req.method !== "POST") throw new MethodNotAllowedError(["POST"]);
    return await handleDashboardBillingManage(ctx, customer);
  }
  if (path === "/dashboard/batch") {
    if (req.method !== "GET") throw new MethodNotAllowedError(["GET"]);
    return await handleDashboardBatch(ctx, customer);
  }
  throw new NotFoundError();
}

function handleLoginGet(): Response {
  return htmlResponse(renderLoginPage({}));
}

async function handleLoginPost(req: Request, ctx: DashboardCtx): Promise<Response> {
  const form = await readForm(req);
  const apiKey = (form.get("api_key") ?? "").trim();
  if (!apiKey) {
    return htmlResponse(renderLoginPage({ error: "Please provide an API key." }), 400);
  }
  const record = await lookupKeyByPlaintext(ctx.kv, apiKey);
  if (record === null || record.customer_id === null) {
    // Unknown / revoked / grandfathered internal keys all fall here. Do not
    // differentiate — same generic error avoids probe-for-state leakage.
    return htmlResponse(
      renderLoginPage({ error: "That key is not valid for dashboard access." }),
      401,
    );
  }

  const session = await createSession(ctx.kv, record.customer_id, ctx.config.sessionSecret, {
    now: ctx.now,
    // `Secure` is default-on; locally `server.ts` is HTTP so tests opt out.
    secure: isSecureRequest(req),
  });

  return new Response(null, {
    status: 303,
    headers: {
      "Location": "/dashboard",
      "Set-Cookie": session.set_cookie,
    },
  });
}

async function handleLogout(req: Request, ctx: DashboardCtx): Promise<Response> {
  const session = await validateSessionFromRequest(
    req,
    ctx.kv,
    ctx.config.sessionSecret,
  );
  if (session !== null) {
    await destroySession(ctx.kv, session.id);
  }
  return new Response(null, {
    status: 303,
    headers: {
      "Location": "/login",
      "Set-Cookie": clearSessionCookie({ secure: isSecureRequest(req) }),
    },
  });
}

async function handleDashboardOverview(
  ctx: DashboardCtx,
  customer: CustomerRecord,
): Promise<Response> {
  const nowDate = (ctx.now ?? (() => new Date()))();
  const limit = quotaFor(customer.tier, ctx.config);
  const snapshot = await peekUsage(ctx.kv, customer.id, {
    tier: customer.tier,
    limit,
    now: nowDate,
  });
  return htmlResponse(
    renderDashboardLayout({
      tab: "overview",
      customer,
      body: renderOverviewBody(customer, {
        used: snapshot.used,
        limit: snapshot.limit,
        remaining: snapshot.remaining,
        month: currentMonthYYYYMM(nowDate),
        resetAt: snapshot.reset_at,
      }),
    }),
  );
}

async function handleDashboardKeys(
  ctx: DashboardCtx,
  customer: CustomerRecord,
): Promise<Response> {
  const keys = await listKeysByCustomer(ctx.kv, customer.id);
  return htmlResponse(
    renderDashboardLayout({
      tab: "keys",
      customer,
      body: renderKeysBody(keys, null),
    }),
  );
}

async function handleDashboardKeysRotate(
  req: Request,
  ctx: DashboardCtx,
  customer: CustomerRecord,
): Promise<Response> {
  const form = await readForm(req);
  const keyId = (form.get("key_id") ?? "").trim();
  if (!keyId) throw new BadRequestError("Missing key_id");

  // Prevent a session from rotating a key it does not own.
  await assertKeyOwnership(ctx.kv, customer.id, keyId);

  const rotated = await rotateKey(ctx.kv, keyId);
  if (rotated === null) {
    // Already revoked or unknown id. Render the current table fragment as a
    // recoverable no-op rather than a 400 — the UI already reflects reality.
    const keys = await listKeysByCustomer(ctx.kv, customer.id);
    return htmlResponse(renderKeysBody(keys, null));
  }
  const keys = await listKeysByCustomer(ctx.kv, customer.id);
  return htmlResponse(
    renderKeysBody(keys, {
      plaintext: rotated.new.plaintext,
      newKeyId: rotated.new.record.id,
      oldKeyId: rotated.old.id,
    }),
  );
}

async function handleDashboardKeysRevoke(
  req: Request,
  ctx: DashboardCtx,
  customer: CustomerRecord,
): Promise<Response> {
  const form = await readForm(req);
  const keyId = (form.get("key_id") ?? "").trim();
  if (!keyId) throw new BadRequestError("Missing key_id");

  await assertKeyOwnership(ctx.kv, customer.id, keyId);
  await revokeKey(ctx.kv, keyId);

  const keys = await listKeysByCustomer(ctx.kv, customer.id);
  return htmlResponse(renderKeysBody(keys, null));
}

async function handleDashboardBilling(
  ctx: DashboardCtx,
  customer: CustomerRecord,
): Promise<Response> {
  const subscription = await lookupSubscription(ctx.kv, customer.id);
  return htmlResponse(
    renderDashboardLayout({
      tab: "billing",
      customer,
      body: renderBillingBody(customer, ctx.config, subscription),
    }),
  );
}

async function handleDashboardBillingUpgrade(
  ctx: DashboardCtx,
  customer: CustomerRecord,
): Promise<Response> {
  if (customer.tier === "pro") {
    return redirect303("/dashboard/billing");
  }
  if (!isStripeConfigured(ctx.config)) {
    throw new BadRequestError("Stripe is not configured on this deployment");
  }
  const baseUrl = ctx.config.publicBaseUrl;
  const session = await createCheckoutSession(ctx.config, {
    customerId: customer.id,
    customerEmail: customer.email,
    stripeCustomerId: customer.stripe_customer_id,
    priceId: ctx.config.stripePriceIdPro,
    successUrl: `${baseUrl}/dashboard/billing?checkout=success`,
    cancelUrl: `${baseUrl}/dashboard/billing?checkout=cancel`,
  });
  return redirect303(session.url);
}

async function handleDashboardBillingManage(
  ctx: DashboardCtx,
  customer: CustomerRecord,
): Promise<Response> {
  if (!customer.stripe_customer_id) {
    return redirect303("/dashboard/billing");
  }
  if (!isStripeConfigured(ctx.config)) {
    throw new BadRequestError("Stripe is not configured on this deployment");
  }
  const session = await createBillingPortalSession(
    ctx.config,
    customer.stripe_customer_id,
    `${ctx.config.publicBaseUrl}/dashboard/billing`,
  );
  return redirect303(session.url);
}

function isStripeConfigured(config: Config): boolean {
  return Boolean(
    config.stripeSecretKey &&
      config.stripePriceIdPro &&
      config.publicBaseUrl,
  );
}

function redirect303(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { "Location": location },
  });
}

/** Hide both missing keys and keys belonging to other customers behind 404. */
async function assertKeyOwnership(
  kv: Deno.Kv,
  customerId: string,
  keyId: string,
): Promise<void> {
  const indexEntry = await kv.get<string>(["keys_index", keyId]);
  if (indexEntry.value === null) throw new NotFoundError();
  const recordEntry = await kv.get<ApiKeyRecord>(["keys", indexEntry.value]);
  if (recordEntry.value === null) throw new NotFoundError();
  if (recordEntry.value.customer_id !== customerId) {
    // Respond as not-found rather than 403 so we don't confirm the key
    // exists — same principle as authenticate()'s generic 401.
    throw new NotFoundError();
  }
}

/** Deno Deploy supplies HTTPS URLs after upstream TLS termination. */
function isSecureRequest(req: Request): boolean {
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

async function readForm(req: Request): Promise<URLSearchParams> {
  const ctype = (req.headers.get("content-type") ?? "").toLowerCase();
  if (!ctype.includes("application/x-www-form-urlencoded")) {
    throw new BadRequestError("Content-Type must be application/x-www-form-urlencoded");
  }
  const text = await req.text();
  return new URLSearchParams(text);
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function handleDashboardBatch(
  _ctx: DashboardCtx,
  customer: CustomerRecord,
): Response {
  if (customer.tier !== "pro") return redirect303("/dashboard/billing");
  const body = renderBatchBody();
  return htmlResponse(renderDashboardLayout({ tab: "batch", customer, body }));
}

export {
  escHtml,
  HTMX_SCRIPT_TAG,
  renderDashboardLayout,
  renderKeysBody,
  renderLoginPage,
} from "./dashboard_views.ts";
export type { SessionRecord };
