/** Pure HTML templates for the session-authenticated dashboard. */
import type { Config } from "./config.ts";
import type { ApiKeyRecord } from "./keys.ts";
import type { CustomerRecord } from "./customers.ts";
import type { SubscriptionRecord } from "./webhooks.ts";

/** Minimal HTML-escape for untrusted values injected into templates. */
export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const HTMX_SCRIPT_TAG =
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

export function renderLoginPage(opts: { error?: string }): string {
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

export function renderDashboardLayout(opts: {
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
      ${customer.tier === "pro" ? link("/dashboard/batch", "Batch", "batch") : ""}
      ${link("/dashboard/billing", "Billing", "billing")}
    </nav>
    <main class="panel">${body}</main>
  </div>
</body>
</html>`;
}

export function renderOverviewBody(
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

export function renderKeysBody(
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

export function renderBillingBody(
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
