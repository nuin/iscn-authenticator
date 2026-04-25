/**
 * Session-authenticated dashboard (HTML + HTMX).
 *
 * Flow:
 *   - `GET  /login`                   — form accepting an API key
 *   - `POST /login`                   — validates the key, resolves its
 *                                        owning customer, creates a session,
 *                                        303s to `/dashboard`
 *   - `POST /logout`                  — destroys session, clears cookie
 *   - `GET  /dashboard`               — Overview tab (email, tier, usage)
 *   - `GET  /dashboard/keys`          — Keys tab (owned keys + actions)
 *   - `POST /dashboard/keys/rotate`   — HTMX fragment: rotate a key, reveal
 *                                        the new plaintext once
 *   - `POST /dashboard/keys/revoke`   — HTMX fragment: mark a key revoked
 *   - `GET  /dashboard/billing`       — Billing tab (stub until M2/9)
 *
 * All `/dashboard*` routes require a valid session cookie. The session is
 * scoped to a single customer — users only ever see their own keys + usage.
 * Grandfathered keys (customer_id=null) cannot log in here; they're
 * internal-only and use the Admin CLI instead.
 *
 * CSRF posture: session cookie is `SameSite=Lax`, so cross-site POST forms
 * do not ship it. We also gate writes by method (POST only) and require the
 * session, which closes the practical attack surface for M2. HTMX
 * same-origin requests include the cookie automatically.
 */

import type { Config } from "./config.ts";
import { authenticateSession } from "./auth.ts";
import {
  BadRequestError,
  MethodNotAllowedError,
  NotFoundError,
  UnauthenticatedError,
} from "./errors.ts";
import { listKeysByCustomer, lookupKeyByPlaintext, revokeKey, rotateKey } from "./keys.ts";
import type { ApiKeyRecord } from "./keys.ts";
import { lookupCustomerById } from "./customers.ts";
import type { CustomerRecord } from "./customers.ts";
import { createBillingPortalSession, createCheckoutSession } from "./stripe.ts";
import { lookupSubscription, type SubscriptionRecord } from "./webhooks.ts";
import {
  clearSessionCookie,
  createSession,
  destroySession,
  validateSessionFromRequest,
} from "./sessions.ts";
import type { SessionRecord } from "./sessions.ts";
import { currentMonthYYYYMM, peekUsage, quotaFor } from "./quota.ts";

// ---------------------------------------------------------------------------
// Route entry points
// ---------------------------------------------------------------------------

export interface DashboardCtx {
  kv: Deno.Kv;
  config: Config;
  /** Test hook: clock for deterministic usage/session windows. */
  now?: () => Date;
}

/** Return true if the path is a dashboard route we own. */
export function isDashboardPath(path: string): boolean {
  if (path === "/login" || path === "/logout") return true;
  if (path === "/dashboard") return true;
  if (path.startsWith("/dashboard/")) return true;
  return false;
}

/** Return true if the response should carry the dashboard CSP (allows HTMX CDN). */
export function isDashboardResponse(path: string): boolean {
  return isDashboardPath(path);
}

/** Top-level dispatcher called from middleware for any dashboard path. */
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

// ---------------------------------------------------------------------------
// /login
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// /dashboard (Overview)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// /dashboard/keys
// ---------------------------------------------------------------------------

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
    return htmlFragmentResponse(renderKeysBody(keys, null));
  }
  const keys = await listKeysByCustomer(ctx.kv, customer.id);
  return htmlFragmentResponse(
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
  return htmlFragmentResponse(renderKeysBody(keys, null));
}

// ---------------------------------------------------------------------------
// /dashboard/billing
// ---------------------------------------------------------------------------

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

/**
 * Create a Stripe Checkout Session and redirect the browser to it.
 *
 * Guardrails:
 *   - Pro customers cannot upgrade again — return to /dashboard/billing.
 *   - Stripe config must be present; otherwise the button should not have
 *     been rendered, but we surface a 400 just in case.
 */
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

/**
 * Hand the customer over to Stripe's Billing Portal so they can update
 * card details, download invoices, or cancel. Requires that we have
 * already attached a Stripe customer id — which we only do via
 * `checkout.session.completed`. Free customers who somehow hit this path
 * get redirected back to billing.
 */
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reject an attempt to operate on someone else's key. The rotate/revoke
 * forms are rendered from the keys list so this check is defence-in-depth —
 * it fails closed if a user forges a key_id in a replayed form submission.
 */
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

/**
 * Determine whether to set the `Secure` flag on the session cookie.
 *
 * Production terminates TLS upstream (Deno Deploy) so the request URL is
 * `https://`; local dev is plain HTTP. This heuristic matches what the
 * existing API surface does for `Secure` cookies elsewhere.
 */
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

/**
 * Response that carries only an HTMX-swappable fragment (no <html> wrapper).
 * We still serve it as text/html so HTMX swaps it directly into the DOM.
 */
function htmlFragmentResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

/** Minimal HTML-escape for untrusted values injected into templates. */
export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const HTMX_SCRIPT_TAG =
  '<script src="https://unpkg.com/htmx.org@1.9.10" integrity="sha384-D1Kt99CQMDuVetoL1lrYwg5t+9QdHe7NLX/SoJYkXDFfX37iInKRy5xLSi8nO7UC" crossorigin="anonymous"></script>';

const BASE_CSS = `
  :root {
    --color-bg: #f8f9fa;
    --color-surface: #ffffff;
    --color-text: #212529;
    --color-text-muted: #6c757d;
    --color-primary: #0d6efd;
    --color-primary-hover: #0b5ed7;
    --color-border: #dee2e6;
    --color-valid: #198754;
    --color-valid-bg: #d1e7dd;
    --color-invalid: #dc3545;
    --color-invalid-bg: #f8d7da;
    --font-mono: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
    --radius: 8px;
    --shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--color-bg); color: var(--color-text); line-height: 1.5; min-height: 100vh; }
  a { color: var(--color-primary); }
  .container { max-width: 960px; margin: 0 auto; padding: 2rem 1rem; }
  header.top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.5rem; }
  header.top h1 { font-size: 1.25rem; font-weight: 600; }
  header.top .meta { color: var(--color-text-muted); font-size: 0.875rem; }
  nav.tabs { display: flex; gap: 0.25rem; border-bottom: 1px solid var(--color-border); margin-bottom: 1.5rem; flex-wrap: wrap; }
  nav.tabs a { padding: 0.5rem 1rem; text-decoration: none; color: var(--color-text-muted); border-bottom: 2px solid transparent; }
  nav.tabs a.active { color: var(--color-text); border-bottom-color: var(--color-primary); font-weight: 500; }
  main.panel { background: var(--color-surface); border-radius: var(--radius); padding: 1.5rem; box-shadow: var(--shadow); }
  h2 { font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; }
  .kv { display: grid; grid-template-columns: max-content 1fr; gap: 0.5rem 1rem; margin-bottom: 1.5rem; }
  .kv dt { font-weight: 500; color: var(--color-text-muted); }
  .kv dd { font-family: var(--font-mono); }
  .progress { background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius); height: 10px; overflow: hidden; margin-bottom: 0.25rem; }
  .progress > span { display: block; height: 100%; background: var(--color-primary); }
  .progress-caption { font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 1rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--color-border); }
  th { color: var(--color-text-muted); font-weight: 500; font-size: 0.8125rem; text-transform: uppercase; letter-spacing: 0.02em; }
  td.mono { font-family: var(--font-mono); }
  .btn { font-size: 0.8125rem; padding: 0.35rem 0.75rem; border-radius: var(--radius); border: 1px solid var(--color-border); background: var(--color-bg); color: var(--color-text); cursor: pointer; }
  .btn:hover { background: var(--color-surface); border-color: var(--color-primary); }
  .btn-primary { background: var(--color-primary); color: white; border-color: var(--color-primary); }
  .btn-primary:hover { background: var(--color-primary-hover); border-color: var(--color-primary-hover); }
  .btn-danger { color: var(--color-invalid); border-color: var(--color-invalid); background: transparent; }
  .btn-danger:hover { background: var(--color-invalid-bg); }
  .tag { display: inline-block; font-size: 0.75rem; padding: 0.1rem 0.5rem; border-radius: 999px; background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-text-muted); }
  .tag.pro { background: var(--color-valid-bg); color: var(--color-valid); border-color: var(--color-valid); }
  .tag.revoked { background: var(--color-invalid-bg); color: var(--color-invalid); border-color: var(--color-invalid); }
  form.login { display: flex; flex-direction: column; gap: 0.75rem; max-width: 420px; }
  form.login label { font-weight: 500; font-size: 0.875rem; }
  form.login input[type="password"], form.login input[type="text"] { font-family: var(--font-mono); font-size: 1rem; padding: 0.65rem 0.85rem; border: 2px solid var(--color-border); border-radius: var(--radius); outline: none; }
  form.login input:focus { border-color: var(--color-primary); }
  form.login .error { color: var(--color-invalid); font-size: 0.875rem; }
  .plaintext-reveal { background: var(--color-valid-bg); border: 1px solid var(--color-valid); border-radius: var(--radius); padding: 1rem; margin-bottom: 1rem; font-size: 0.875rem; }
  .plaintext-reveal strong { display: block; margin-bottom: 0.25rem; }
  .plaintext-reveal code { display: block; font-family: var(--font-mono); background: var(--color-surface); padding: 0.5rem 0.75rem; border-radius: var(--radius); word-break: break-all; margin-top: 0.5rem; }
  .muted { color: var(--color-text-muted); font-size: 0.875rem; }
`;

function renderLoginPage(opts: { error?: string }): string {
  const err = opts.error ? `<p class="error">${escHtml(opts.error)}</p>` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Log in — ISCN Authenticator</title>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div class="container" style="max-width: 480px;">
    <header class="top">
      <h1>ISCN Authenticator</h1>
      <a href="/" class="meta">Back to validator</a>
    </header>
    <main class="panel">
      <h2>Log in</h2>
      <p class="muted" style="margin-bottom: 1rem;">Paste one of your API keys to access the dashboard.</p>
      <form class="login" method="POST" action="/login">
        ${err}
        <label for="api_key">API key</label>
        <input type="password" id="api_key" name="api_key" autocomplete="off" spellcheck="false" required>
        <button type="submit" class="btn btn-primary">Continue</button>
      </form>
    </main>
  </div>
</body>
</html>`;
}

function renderDashboardLayout(opts: {
  tab: "overview" | "keys" | "batch" | "billing";
  customer: CustomerRecord;
  body: string;
}): string {
  const { tab, customer, body } = opts;
  const link = (href: string, label: string, name: typeof tab) =>
    `<a href="${href}"${tab === name ? ' class="active"' : ""}>${label}</a>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — ISCN Authenticator</title>
  <style>${BASE_CSS}</style>
  ${HTMX_SCRIPT_TAG}
</head>
<body>
  <div class="container">
    <header class="top">
      <h1>Dashboard</h1>
      <div class="meta">
        <span>${escHtml(customer.email)}</span>
        <span> · </span>
        <form method="POST" action="/logout" style="display:inline;">
          <button type="submit" class="btn" style="padding: 0.2rem 0.6rem;">Log out</button>
        </form>
      </div>
    </header>
    <nav class="tabs">
      ${link("/dashboard", "Overview", "overview")}
      ${link("/dashboard/keys", "Keys", "keys")}
      ${customer.tier === "pro" ? link("/dashboard/batch", "Batch", "batch" as any) : ""}
      ${link("/dashboard/billing", "Billing", "billing")}
    </nav>
    <main class="panel">${body}</main>
  </div>
</body>
</html>`;
}

async function handleDashboardBatch(
  _ctx: DashboardCtx,
  customer: CustomerRecord,
): Promise<Response> {
  if (customer.tier !== "pro") {
    return redirectResponse("/dashboard/billing");
  }
  const body = renderBatchBody();
  return htmlResponse(renderDashboardLayout({ tab: "batch", customer, body }));
}

function renderBatchBody(): string {
  return `
    <h2>Batch Validation</h2>
    <p class="muted" style="margin-bottom: 1.5rem;">Enter one karyotype per line (up to 500). Processing is done entirely in your browser.</p>
    
    <div style="margin-bottom: 1.5rem;">
      <textarea id="batch-input" style="width: 100%; height: 200px; font-family: var(--font-mono); padding: 0.75rem; border: 2px solid var(--color-border); border-radius: var(--radius); resize: vertical; outline: none; transition: border-color 0.2s;" placeholder="46,XX\n47,XY,+21\n..."></textarea>
    </div>
    
    <div style="display: flex; gap: 0.5rem; margin-bottom: 2rem; flex-wrap: wrap;">
      <button id="batch-run" class="btn btn-primary">Run Batch</button>
      <button id="batch-clear" class="btn">Clear</button>
      <div style="flex: 1; min-width: 1rem;"></div>
      <button id="batch-export-csv" class="btn" disabled>Export CSV</button>
      <button id="batch-export-json" class="btn" disabled>Export JSON</button>
    </div>

    <div id="batch-results-container" class="hidden" style="margin-top: 2rem;">
      <h3 style="font-size: 1rem; margin-bottom: 1rem;">Results (<span id="batch-count">0</span>)</h3>
      <div style="overflow-x: auto;">
        <table id="batch-table">
          <thead>
            <tr>
              <th style="width: 30%;">Karyotype</th>
              <th style="width: 15%;">Status</th>
              <th>Explanation / Errors</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

    <script type="module">
      import { validateKaryotypeNative, explain } from "/static/iscn-core.js";

      const input = document.getElementById('batch-input');
      const runBtn = document.getElementById('batch-run');
      const clearBtn = document.getElementById('batch-clear');
      const csvBtn = document.getElementById('batch-export-csv');
      const jsonBtn = document.getElementById('batch-export-json');
      const resultsContainer = document.getElementById('batch-results-container');
      const tbody = document.querySelector('#batch-table tbody');
      const countSpan = document.getElementById('batch-count');

      let currentResults = [];

      runBtn.onclick = () => {
        const lines = input.value.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) return;
        if (lines.length > 500) {
          alert('Maximum 500 lines allowed.');
          return;
        }

        runBtn.disabled = true;
        runBtn.textContent = 'Processing...';
        tbody.innerHTML = '';
        currentResults = [];

        lines.forEach(k => {
          try {
            const result = validateKaryotypeNative(k);
            let explanation = '—';
            if (result.parsed) {
              const exp = explain(result.parsed);
              explanation = exp.summary;
            } else if (result.errors.length > 0) {
              explanation = result.errors.join('; ');
            }
            
            const row = { karyotype: k, valid: result.valid, explanation };
            currentResults.push(row);
            
            const tr = document.createElement('tr');
            tr.innerHTML = \`
              <td class="mono" style="word-break: break-all;">\${esc(k)}</td>
              <td><span class="tag \${row.valid ? 'pro' : 'revoked'}">\${row.valid ? 'VALID' : 'INVALID'}</span></td>
              <td style="font-size: 0.75rem; color: var(--color-text-muted);">\${esc(explanation)}</td>
            \`;
            tbody.appendChild(tr);
          } catch (err) {
            console.error(err);
          }
        });

        countSpan.textContent = currentResults.length;
        resultsContainer.classList.remove('hidden');
        csvBtn.disabled = false;
        jsonBtn.disabled = false;
        runBtn.disabled = false;
        runBtn.textContent = 'Run Batch';
      };

      clearBtn.onclick = () => {
        input.value = '';
        tbody.innerHTML = '';
        resultsContainer.classList.add('hidden');
        csvBtn.disabled = true;
        jsonBtn.disabled = true;
        currentResults = [];
      };

      csvBtn.onclick = () => {
        const headers = ['Karyotype', 'Valid', 'Explanation/Errors'];
        const csv = [
          headers.join(','),
          ...currentResults.map(r => [
            '"' + r.karyotype.replace(/"/g, '""') + '"',
            r.valid ? 'true' : 'false',
            '"' + r.explanation.replace(/"/g, '""') + '"'
          ].join(','))
        ].join('\\n');
        download(csv, 'iscn-batch-results.csv', 'text/csv');
      };

      jsonBtn.onclick = () => {
        download(JSON.stringify(currentResults, null, 2), 'iscn-batch-results.json', 'application/json');
      };

      function download(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }

      function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    </script>
    <style>
      .hidden { display: none; }
      #batch-input:focus { border-color: var(--color-primary); }
    </style>
  `;
}

function redirectResponse(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { "Location": location },
  });
}

function renderOverviewBody(
  customer: CustomerRecord,
  usage: { used: number; limit: number; remaining: number; month: string; resetAt: number },
): string {
  const pct = usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0;
  const tierBadge = customer.tier === "pro"
    ? '<span class="tag pro">Pro</span>'
    : '<span class="tag">Free</span>';
  const resetIso = new Date(usage.resetAt * 1000).toISOString();
  return `
    <h2>Account</h2>
    <dl class="kv">
      <dt>Email</dt><dd>${escHtml(customer.email)}</dd>
      <dt>Customer ID</dt><dd>${escHtml(customer.id)}</dd>
      <dt>Tier</dt><dd>${tierBadge}</dd>
      <dt>Status</dt><dd>${escHtml(customer.status)}</dd>
    </dl>
    <h2>Usage this month (${escHtml(usage.month)})</h2>
    <div class="progress" aria-label="monthly usage"><span style="width: ${pct}%;"></span></div>
    <p class="progress-caption">${usage.used.toLocaleString()} / ${usage.limit.toLocaleString()} requests · ${usage.remaining.toLocaleString()} remaining · resets ${
    escHtml(resetIso)
  }</p>
  `;
}

function renderKeysBody(
  keys: ApiKeyRecord[],
  reveal: { plaintext: string; newKeyId: string; oldKeyId: string } | null,
): string {
  const revealHtml = reveal
    ? `<div class="plaintext-reveal">
        <strong>New key ready — copy it now, it will not be shown again.</strong>
        Rotated <code>${escHtml(reveal.oldKeyId)}</code> → <code>${escHtml(reveal.newKeyId)}</code>
        <code>${escHtml(reveal.plaintext)}</code>
      </div>`
    : "";
  if (keys.length === 0) {
    return `
      <div id="keys-panel">
        <h2>API keys</h2>
        ${revealHtml}
        <p class="muted">No keys yet. Contact support to create one, or use the signup flow if you're onboarding.</p>
      </div>`;
  }
  const rows = keys.map((k) => renderKeyRow(k)).join("");
  return `
    <div id="keys-panel">
      <h2>API keys</h2>
      ${revealHtml}
      <table>
        <thead>
          <tr><th>ID</th><th>Label</th><th>Env</th><th>Created</th><th>Last used</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="muted" style="margin-top: 0.75rem;">Rotation issues a new key and revokes the old one in the same call — swap credentials immediately.</p>
    </div>`;
}

function renderKeyRow(k: ApiKeyRecord): string {
  const revoked = k.revoked_at !== null;
  const statusTag = revoked
    ? '<span class="tag revoked">Revoked</span>'
    : '<span class="tag">Active</span>';
  const actions = revoked
    ? ""
    : `<form hx-post="/dashboard/keys/rotate" hx-target="#keys-panel" hx-swap="outerHTML" style="display:inline;">
         <input type="hidden" name="key_id" value="${escHtml(k.id)}">
         <button type="submit" class="btn">Rotate</button>
       </form>
       <form hx-post="/dashboard/keys/revoke" hx-target="#keys-panel" hx-swap="outerHTML" hx-confirm="Revoke this key? This cannot be undone." style="display:inline;">
         <input type="hidden" name="key_id" value="${escHtml(k.id)}">
         <button type="submit" class="btn btn-danger">Revoke</button>
       </form>`;
  return `<tr>
    <td class="mono">${escHtml(k.id)}</td>
    <td>${escHtml(k.label)}</td>
    <td>${escHtml(k.env)}</td>
    <td class="mono">${escHtml(k.created_at)}</td>
    <td class="mono">${escHtml(k.last_used_at ?? "—")}</td>
    <td>${statusTag}</td>
    <td>${actions}</td>
  </tr>`;
}

function renderBillingBody(
  customer: CustomerRecord,
  config: Config,
  subscription: SubscriptionRecord | null,
): string {
  const stripeReady = Boolean(
    config.stripeSecretKey &&
      config.stripePriceIdPro &&
      config.publicBaseUrl,
  );

  if (customer.tier === "pro") {
    const period = subscription
      ? `<p class="muted" style="margin-top: 0.5rem;">Current period ends <code>${
        escHtml(subscription.current_period_end)
      }</code>${
        subscription.cancel_at_period_end ? " · <strong>will cancel at period end</strong>" : ""
      }.</p>`
      : "";
    const manageForm = stripeReady && customer.stripe_customer_id
      ? `<form method="POST" action="/dashboard/billing/manage" style="margin-top: 1rem;">
          <button type="submit" class="btn btn-primary">Manage billing in Stripe</button>
        </form>`
      : `<p class="muted" style="margin-top: 0.5rem;">Stripe portal is unavailable on this deployment. Contact support to change billing.</p>`;
    const statusBadge = customer.status === "past_due"
      ? ' <span class="tag revoked">Payment past due</span>'
      : customer.status === "cancelled"
      ? ' <span class="tag revoked">Cancelled</span>'
      : "";
    return `
      <h2>Billing</h2>
      <p>You are on the <strong>Pro</strong> plan.${statusBadge}</p>
      ${period}
      ${manageForm}
    `;
  }

  // Free tier: show upgrade button when Stripe is configured.
  const upgradeForm = stripeReady
    ? `<form method="POST" action="/dashboard/billing/upgrade" style="margin-top: 1rem;">
        <button type="submit" class="btn btn-primary">Upgrade to Pro</button>
      </form>`
    : `<p class="muted" style="margin-top: 0.5rem;">Upgrade is disabled: Stripe is not configured on this deployment.</p>`;
  return `
    <h2>Billing</h2>
    <p>You are on the <strong>Free</strong> plan.</p>
    <p class="muted" style="margin-top: 0.5rem;">Pro removes the monthly-quota ceiling and unlocks higher burst limits.</p>
    ${upgradeForm}
  `;
}

// ---------------------------------------------------------------------------
// Re-exports kept narrow — consumers outside middleware.ts don't need the
// renderers. Exported for tests + main.ts embedding checks.
// ---------------------------------------------------------------------------

export { HTMX_SCRIPT_TAG, renderDashboardLayout, renderKeysBody, renderLoginPage };
export type { SessionRecord };
