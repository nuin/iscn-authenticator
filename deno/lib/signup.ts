/**
 * Self-serve signup endpoint.
 *
 * Flow:
 *   GET  /signup  → render the email-only form.
 *   POST /signup  → rate-limit per IP, validate email, create customer
 *                   (free tier) + first API key, open a session, return an
 *                   HTML page that reveals the plaintext key exactly once
 *                   and sets the session cookie so "Continue to dashboard"
 *                   lands the user already authenticated.
 *
 * Design notes:
 *   - Accepts both `application/x-www-form-urlencoded` (the page's own
 *     `<form>` submission) and `application/json` (programmatic signups,
 *     e.g. from docs/demos) — the body shape is `{ email }` either way.
 *   - Per-IP rate limit `signup:<ip>` at 10/hour burst 10. Uses the same
 *     token-bucket primitive as the auth hot path, so the knobs are well
 *     understood operationally.
 *   - No email verification in M2 (explicit non-goal). Mitigation against
 *     signing up with someone else's address relies on (a) this rate limit,
 *     and (b) the fact that we never send outbound mail — the only
 *     user-visible surface is the plaintext reveal which the victim cannot
 *     see, so the attack class is low-value.
 *   - Duplicate email surfaces as an `invalid_signup` 400 (deliberate
 *     rather than probing via separate 409 to keep the wire protocol
 *     narrow and the error taxonomy stable with M1).
 */

import type { Config } from "./config.ts";
import {
  BadRequestError,
  InvalidSignupError,
  MethodNotAllowedError,
  RateLimitError,
} from "./errors.ts";
import {
  canonicaliseEmail,
  createCustomer,
  isPlausibleEmail,
  lookupCustomerByEmail,
} from "./customers.ts";
import { createKey } from "./keys.ts";
import { createSession } from "./sessions.ts";
import { checkAndConsume } from "./token_bucket.ts";
import { escHtml } from "./dashboard.ts";

/** Per-IP signup rate limit: 10 signups/hour, burst of 10. */
const SIGNUP_RATE_PER_MIN = 10 / 60; // 10/hour expressed as per-minute
const SIGNUP_BURST = 10;

/** Truthy if the given request path routes through this module. */
export function isSignupPath(path: string): boolean {
  return path === "/signup";
}

export interface HandleSignupArgs {
  kv: Deno.Kv;
  config: Config;
  /**
   * Client IP used as the signup rate-limit key. `null` when `clientIp()`
   * could not resolve one (e.g. local test invocations with no `info` arg);
   * in that case we fall back to a fixed `"unknown"` bucket so tests remain
   * deterministic and malicious traffic still shares a single bucket.
   */
  ip: string | null;
  /** Test hook: override `Date.now()` for deterministic bucket windows. */
  now?: () => number;
}

/** Dispatch `/signup` by HTTP method. */
export async function handleSignupRoute(
  req: Request,
  args: HandleSignupArgs,
): Promise<Response> {
  if (req.method === "GET") {
    return htmlResponse(renderSignupPage({}));
  }
  if (req.method === "POST") {
    return await handleSignupSubmit(req, args);
  }
  throw new MethodNotAllowedError(["GET", "POST"]);
}

async function handleSignupSubmit(
  req: Request,
  args: HandleSignupArgs,
): Promise<Response> {
  const { kv, config, ip } = args;
  const bucketKey = `signup:${ip ?? "unknown"}`;

  // 1. Rate-limit per-IP BEFORE touching storage so abusers pay zero KV cost.
  const rl = await checkAndConsume(kv, bucketKey, {
    ratePerMin: SIGNUP_RATE_PER_MIN,
    burst: SIGNUP_BURST,
    now: args.now,
  });
  if (!rl.allowed) {
    throw new RateLimitError(rl.retry_after, "Too many signup attempts");
  }

  // 2. Parse email from either a form POST or a JSON body.
  const rawEmail = await readEmailFromBody(req);
  if (rawEmail === "") {
    throw new InvalidSignupError("Email is required");
  }
  if (!isPlausibleEmail(rawEmail)) {
    throw new InvalidSignupError("Invalid email address");
  }

  // 3. Reject duplicate early with a specific message. `createCustomer`
  // would also catch this via its atomic check, but handling it here keeps
  // the plaintext-key side-effect from ever being computed on rejection.
  const existing = await lookupCustomerByEmail(kv, rawEmail);
  if (existing !== null) {
    throw new InvalidSignupError("Email already registered");
  }

  // 4. Create customer + first key + session in that order. Each step can
  // still fail on optimistic-concurrency races; creation is idempotent
  // from the caller's view because the duplicate-email check above
  // guarantees a fresh record is needed.
  const customer = await createCustomer(kv, rawEmail);
  if (customer === null) {
    // Race: another concurrent signup won the atomic commit.
    throw new InvalidSignupError("Email already registered");
  }

  const created = await createKey(kv, "Initial key", {
    env: "live",
    customerId: customer.id,
  });

  const session = await createSession(kv, customer.id, config.sessionSecret, {
    secure: isSecureRequest(req),
  });

  // 5. Render the one-time plaintext reveal page.
  const body = renderSignupSuccessPage({
    email: canonicaliseEmail(rawEmail),
    plaintext: created.plaintext,
    keyId: created.record.id,
  });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": session.set_cookie,
    },
  });
}

/**
 * Read the submitted email from either a form POST or a JSON body. Returns
 * the trimmed-but-not-canonicalised string (so downstream validation can
 * still reject "  foo  " shapes if we ever tighten the rules).
 */
async function readEmailFromBody(req: Request): Promise<string> {
  const ctype = (req.headers.get("content-type") ?? "").toLowerCase();
  if (ctype.includes("application/json")) {
    let parsed: unknown;
    try {
      parsed = await req.json();
    } catch {
      throw new BadRequestError("Body is not valid JSON");
    }
    if (
      parsed === null || typeof parsed !== "object" ||
      typeof (parsed as { email?: unknown }).email !== "string"
    ) {
      throw new InvalidSignupError("Email is required");
    }
    return (parsed as { email: string }).email.trim();
  }
  if (ctype.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    return (params.get("email") ?? "").trim();
  }
  throw new BadRequestError(
    "Content-Type must be application/json or application/x-www-form-urlencoded",
  );
}

/**
 * True when the request arrived over HTTPS (TLS terminated upstream on Deno
 * Deploy). Mirrors the identical helper in `dashboard.ts`; kept local to
 * avoid exporting a two-line private from that module.
 */
function isSecureRequest(req: Request): boolean {
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ---------------------------------------------------------------------------
// HTML rendering
// ---------------------------------------------------------------------------

/** Tiny standalone stylesheet so signup pages stay self-contained. */
const SIGNUP_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f8f9fa;
    color: #212529;
    line-height: 1.5;
    min-height: 100vh;
  }
  a { color: #0d6efd; }
  .container { max-width: 480px; margin: 0 auto; padding: 2rem 1rem; }
  header.top {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 1.5rem;
  }
  header.top h1 { font-size: 1.25rem; font-weight: 600; }
  header.top .meta { color: #6c757d; font-size: 0.875rem; text-decoration: none; }
  main.panel {
    background: #ffffff; border-radius: 8px; padding: 1.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  h2 { font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; }
  p.muted { color: #6c757d; font-size: 0.875rem; margin-bottom: 1rem; }
  form.signup { display: flex; flex-direction: column; gap: 0.75rem; }
  form.signup label { font-weight: 500; font-size: 0.875rem; }
  form.signup input[type="email"] {
    font-size: 1rem; padding: 0.65rem 0.85rem;
    border: 2px solid #dee2e6; border-radius: 8px; outline: none;
  }
  form.signup input:focus { border-color: #0d6efd; }
  form.signup .error { color: #dc3545; font-size: 0.875rem; }
  .btn {
    font-size: 0.875rem; padding: 0.5rem 1rem; border-radius: 8px;
    border: 1px solid #0d6efd; background: #0d6efd; color: white;
    cursor: pointer;
  }
  .btn:hover { background: #0b5ed7; border-color: #0b5ed7; }
  .plaintext-reveal {
    background: #d1e7dd; border: 1px solid #198754; border-radius: 8px;
    padding: 1rem; margin-bottom: 1rem; font-size: 0.875rem;
  }
  .plaintext-reveal strong { display: block; margin-bottom: 0.25rem; }
  .plaintext-reveal code {
    display: block; font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
    background: #ffffff; padding: 0.5rem 0.75rem; border-radius: 8px;
    word-break: break-all; margin-top: 0.5rem;
  }
  dl.kv { display: grid; grid-template-columns: max-content 1fr; gap: 0.5rem 1rem; margin-bottom: 1.5rem; }
  dl.kv dt { font-weight: 500; color: #6c757d; }
  dl.kv dd { font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace; }
`;

/** Render the signup form. `opts.error` renders the prior failure inline. */
export function renderSignupPage(opts: { error?: string; email?: string }): string {
  const err = opts.error ? `<p class="error">${escHtml(opts.error)}</p>` : "";
  const prefill = opts.email ? escHtml(opts.email) : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign up — ISCN Authenticator</title>
  <style>${SIGNUP_CSS}</style>
</head>
<body>
  <div class="container">
    <header class="top">
      <h1>ISCN Authenticator</h1>
      <a href="/" class="meta">Back to validator</a>
    </header>
    <main class="panel">
      <h2>Create an account</h2>
      <p class="muted">Free tier — 10,000 requests per month. No credit card required.</p>
      <form class="signup" method="POST" action="/signup">
        ${err}
        <label for="email">Email</label>
        <input type="email" id="email" name="email" value="${prefill}" autocomplete="email" spellcheck="false" required>
        <button type="submit" class="btn">Sign up</button>
      </form>
      <p class="muted" style="margin-top: 1rem;">Already have a key? <a href="/login">Log in</a>.</p>
    </main>
  </div>
</body>
</html>`;
}

/**
 * One-time plaintext reveal after a successful signup. The session cookie
 * has already been set on the response, so "Continue to dashboard" works
 * without an additional login step.
 */
function renderSignupSuccessPage(opts: {
  email: string;
  plaintext: string;
  keyId: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome — ISCN Authenticator</title>
  <style>${SIGNUP_CSS}</style>
</head>
<body>
  <div class="container">
    <header class="top">
      <h1>ISCN Authenticator</h1>
      <a href="/" class="meta">Back to validator</a>
    </header>
    <main class="panel">
      <h2>Account created</h2>
      <dl class="kv">
        <dt>Email</dt><dd>${escHtml(opts.email)}</dd>
        <dt>Tier</dt><dd>free</dd>
        <dt>Key id</dt><dd>${escHtml(opts.keyId)}</dd>
      </dl>
      <div class="plaintext-reveal">
        <strong>Save this key — it will only be shown once.</strong>
        <code>${escHtml(opts.plaintext)}</code>
      </div>
      <p class="muted">We never store the plaintext. If you lose it, rotate the key from the dashboard.</p>
      <p style="margin-top: 1rem;"><a href="/dashboard" class="btn" style="display: inline-block; text-decoration: none;">Continue to dashboard</a></p>
    </main>
  </div>
</body>
</html>`;
}
