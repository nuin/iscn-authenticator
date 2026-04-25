/**
 * Request pipeline for the ISCN Authenticator API.
 *
 * `buildHandler({ kv, config, staticHtml | staticDir })` returns a single
 * handler used by both `main.ts` (Deno Deploy, embedded HTML) and
 * `server.ts` (local dev, file-backed static/). Keeping the pipeline in
 * one place prevents dev/prod drift on the security surface.
 *
 * Pipeline (executed per request):
 *   1. Generate request_id and capture start time + client IP.
 *   2. Short-circuit CORS preflight (OPTIONS).
 *   3. Route dispatch:
 *        GET  /              -> static HTML (no auth)
 *        GET  /health        -> JSON liveness (no auth)
 *        GET|POST /validate  -> auth + rate limit + body-size + validate
 *        *                   -> 404 via NotFoundError
 *   4. Catch AppError -> typed JSON response via errorToResponse().
 *      Catch anything else -> 500 'internal' with request_id; stack is
 *      logged server-side only.
 *   5. Merge CORS + security + rate-limit headers onto the response.
 *   6. Emit one structured JSON log line with request metadata. Karyotype
 *      payloads are deliberately NOT logged (HIPAA-conservative default).
 */

import type { Config } from "./config.ts";
import {
  AppError,
  BadRequestError,
  BodyTooLargeError,
  errorToResponse,
  MethodNotAllowedError,
  NotFoundError,
  UnauthenticatedError,
} from "./errors.ts";
import type { ErrorCode } from "./errors.ts";
import { authenticate } from "./auth.ts";
import { RateLimitError } from "./errors.ts";
import { checkAndConsume, tokenBucketHeaders } from "./token_bucket.ts";
import { lookupCustomerForKey, rotateKey, sha256Hex, touchKey } from "./keys.ts";
import { lookupCustomerById } from "./customers.ts";
import {
  currentMonthYYYYMM,
  incrementUsage,
  monthlyQuotaHeaders,
  peekUsage,
  quotaFor,
  type QuotaSnapshot,
} from "./quota.ts";
import {
  baseSecurityHeaders,
  dashboardCspHeader,
  htmlCspHeader,
  mergeHeaders,
} from "./security_headers.ts";
import { clientIp, logRequest, requestId } from "./logging.ts";
import type { RequestLog } from "./logging.ts";
import { handleDashboardRoute, isDashboardPath } from "./dashboard.ts";
import { handleSignupRoute, isSignupPath } from "./signup.ts";
import { constructEvent, verifyWebhookSignature } from "./stripe.ts";
import { handleStripeEvent } from "./webhooks.ts";
import {
  handleAboutPage,
  handleDocsPage,
  handlePricingPage,
} from "./pages.ts";
import { StripeWebhookError } from "./errors.ts";
import { validateKaryotypeNative } from "../../packages/core/src/validate.ts";
import { explain } from "../../packages/core/src/index.ts";
import curatedData from "../../packages/core/data/explains/curated.json" with { type: "json" };

export interface BuildHandlerOptions {
  kv: Deno.Kv;
  config: Config;
  /** Embedded HTML for Deno Deploy entrypoint (main.ts). */
  staticHtml?: string;
  /** Filesystem directory for local dev (server.ts). Served on GET /. */
  staticDir?: string;
  /** Embedded static assets (path -> content). */
  staticAssets?: Record<string, string>;
  /** Test hook: inject clock for deterministic rate-limit windows. */
  now?: () => number;
  /** Test hook: override the log sink (defaults to stdout). */
  logSink?: (line: string) => void;
  /**
   * Test hook: override where uncaught errors are reported (defaults to
   * `console.error`). Production does not set this; tests use it both to
   * silence noise and to assert that stack traces land server-side.
   */
  errorSink?: (requestId: string, err: unknown) => void;
}

export type AppHandler = (
  req: Request,
  info?: Deno.ServeHandlerInfo,
) => Promise<Response>;

const CONTENT_TYPE_JSON = "application/json; charset=utf-8";
const CONTENT_TYPE_HTML = "text/html; charset=utf-8";

/** Build the composed request handler. */
export function buildHandler(opts: BuildHandlerOptions): AppHandler {
  const { kv, config, staticHtml, staticDir, staticAssets } = opts;
  const now = opts.now ?? (() => Date.now());
  const logSink = opts.logSink;
  const errorSink = opts.errorSink ??
    ((rid: string, err: unknown) => console.error(`[${rid}] uncaught error:`, err));

  return async function handler(req, info) {
    const rid = requestId();
    const startedAt = now();
    const url = new URL(req.url);
    const path = url.pathname;
    const remoteAddr = (info as { remoteAddr?: { hostname?: string } } | undefined)
      ?.remoteAddr;
    const ip = clientIp(req, remoteAddr);

    // Will be populated as the pipeline advances.
    let status = 500;
    let keyId: string | undefined;
    let errorCode: ErrorCode | undefined;
    let response: Response;

    try {
      // 1. CORS preflight short-circuit.
      if (req.method === "OPTIONS") {
        response = corsPreflight(req, config);
      } else if (path === "/health") {
        response = handleHealth();
      } else if (path === "/validate") {
        response = await handleValidate({ req, kv, config, rid, now });
        // Pull key_id out of response for logging (see handleValidate).
        keyId = (response as ResponseWithMeta)._keyId;
      } else if (path === "/keys/rotate") {
        response = await handleKeysRotate({ req, kv });
        keyId = (response as ResponseWithMeta)._keyId;
      } else if (path === "/usage") {
        response = await handleUsage({ req, kv, config, now });
        keyId = (response as ResponseWithMeta)._keyId;
      } else if (path === "/billing/webhook") {
        response = await handleStripeWebhook({ req, kv, config, now });
      } else if (isDashboardPath(path)) {
        response = await handleDashboardRoute(req, { kv, config });
      } else if (isSignupPath(path)) {
        response = await handleSignupRoute(req, { kv, config, ip, now });
      } else if (path === "/pricing") {
        response = await handlePricingPage();
      } else if (path === "/docs" || path === "/api") {
        response = await handleDocsPage();
      } else if (path === "/about") {
        response = await handleAboutPage();
      } else if (path === "/explain/miss") {
        response = await handleExplainMiss(req, { logSink, rid });
      } else if (path === "/explain" || path.startsWith("/explain/")) {
        response = await handleExplainRoute(req);
      } else if (staticAssets && staticAssets[path]) {
        response = new Response(staticAssets[path], {
          status: 200,
          headers: { "Content-Type": contentTypeFor(path) },
        });
      } else if (path === "/" || path === "/index.html") {
        response = await handleStaticIndex({ staticHtml, staticDir });
      } else if (staticDir && isStaticRequest(path)) {
        response = await handleStaticFile(path, staticDir);
      } else {
        throw new NotFoundError();
      }
    } catch (err) {
      if (err instanceof AppError) {
        errorCode = err.code;
        response = errorToResponse(err, rid, { debug: config.debugErrors });
      } else {
        errorCode = "internal";
        // Full error stays server-side; client gets generic message tied to rid.
        errorSink(rid, err);
        response = errorToResponse(err, rid, { debug: config.debugErrors });
      }
    }

    // 2. Apply CORS + security headers to the response.
    response = applyResponseHeaders(response, {
      req,
      config,
      rid,
      isHtml: isHtmlResponse(response),
      isDashboard: isDashboardPath(path),
    });
    status = response.status;

    // 3. Emit the request log. Karyotype payload is NEVER included.
    const latencyMs = Math.max(0, now() - startedAt);
    const logEntry: RequestLog = {
      ts: new Date(startedAt).toISOString(),
      level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
      request_id: rid,
      ip,
      method: req.method,
      path,
      status,
      latency_ms: latencyMs,
      key_id: keyId ?? null,
      user_agent: req.headers.get("user-agent"),
      error_code: errorCode ?? null,
    };
    logRequest(logEntry, logSink);

    return response;
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

function handleHealth(): Response {
  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { "Content-Type": CONTENT_TYPE_JSON } },
  );
}

async function handleExplainMiss(
  req: Request,
  ctx: { logSink?: (line: string) => void; rid: string },
): Promise<Response> {
  if (req.method !== "POST") {
    throw new MethodNotAllowedError(["POST"]);
  }

  let signature = "";
  try {
    const body = await req.json();
    signature = String(body.signature || "");
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }

  if (!signature) {
    throw new BadRequestError("Missing 'signature' field");
  }

  const hash = await sha256Hex(signature);

  if (ctx.logSink) {
    ctx.logSink(JSON.stringify({
      ts: new Date().toISOString(),
      level: "info",
      request_id: ctx.rid,
      event: "explain_miss",
      signature_hash: hash,
    }));
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": CONTENT_TYPE_JSON },
  });
}

async function handleStaticIndex(
  opts: { staticHtml?: string; staticDir?: string },
): Promise<Response> {
  if (opts.staticHtml !== undefined) {
    return new Response(opts.staticHtml, {
      status: 200,
      headers: { "Content-Type": CONTENT_TYPE_HTML },
    });
  }
  if (opts.staticDir) {
    return await handleStaticFile("/index.html", opts.staticDir);
  }
  throw new NotFoundError();
}

async function handleStaticFile(
  path: string,
  staticDir: string,
): Promise<Response> {
  // Reject path traversal defensively.
  if (path.includes("..")) throw new NotFoundError();
  const filePath = `${staticDir}${path.startsWith("/") ? path : "/" + path}`;
  try {
    const content = await Deno.readFile(filePath);
    return new Response(content, {
      status: 200,
      headers: { "Content-Type": contentTypeFor(path) },
    });
  } catch {
    throw new NotFoundError();
  }
}

/**
 * Auth + rate-limit + validate.
 * Returns a Response annotated with `_keyId` so the outer handler can log
 * it without re-parsing the request. That side-channel is intentional --
 * keeps the AuthIdentity internal to this function's scope.
 */
interface HandleValidateArgs {
  req: Request;
  kv: Deno.Kv;
  config: Config;
  rid: string;
  now: () => number;
}

type ResponseWithMeta = Response & { _keyId?: string };

async function handleValidate(args: HandleValidateArgs): Promise<Response> {
  const { req, kv, config, now } = args;

  if (req.method !== "GET" && req.method !== "POST") {
    throw new MethodNotAllowedError(["GET", "POST"]);
  }

  // 1. Auth (throws UnauthenticatedError on any failure path).
  const identity = await authenticate(req, kv);

  // Fire-and-forget last_used_at update.
  touchKey(kv, identity.key_id).catch(() => {});

  // 2. Rate limit via token bucket (state bump happens BEFORE we do work).
  const rl = await checkAndConsume(kv, identity.key_id, {
    ratePerMin: config.rateLimitPerMin,
    burst: config.rateLimitBurst,
    now,
  });
  const rlHeaders = tokenBucketHeaders(rl);
  if (!rl.allowed) {
    const err = new RateLimitError(rl.retry_after);
    // Surface X-RateLimit-* headers even on 429.
    Object.assign(err.headers, rlHeaders);
    throw err;
  }

  // 2b. Monthly quota (customer-owned keys only — grandfathered keys skip).
  // The denorm `key_customer:<id>` entry is absent for internal keys so
  // this read doubles as the skip check in a single KV hit.
  const quotaHeaders = await enforceMonthlyQuota({
    kv,
    keyId: identity.key_id,
    config,
    now,
  });

  // 3. Extract karyotype.
  let karyotype: string;
  if (req.method === "POST") {
    karyotype = await extractKaryotypeFromBody(req, config);
  } else {
    const url = new URL(req.url);
    const k = url.searchParams.get("karyotype") ?? "";
    if (!k) throw new BadRequestError("Missing 'karyotype' query parameter");
    if (k.length > config.maxKaryotypeLength) {
      throw new BadRequestError(
        `'karyotype' exceeds max length (${config.maxKaryotypeLength})`,
      );
    }
    karyotype = k;
  }

  // 4. Validate.
  const result = validateKaryotypeNative(karyotype);

  // 5. Populate explanations.
  if (result.parsed) {
    result.explanation = explain(result.parsed);
    for (const abn of result.parsed.abnormalities) {
      abn.explanation = explain(abn);
    }
  }

  const response: ResponseWithMeta = new Response(
    JSON.stringify(result),
    {
      status: 200,
      headers: {
        "Content-Type": CONTENT_TYPE_JSON,
        ...rlHeaders,
        ...quotaHeaders,
      },
    },
  ) as ResponseWithMeta;
  response._keyId = identity.key_id;
  return response;
}

/**
 * POST /keys/rotate — authenticated with the OLD key. Issues a sibling key
 * with the same label/env/customer, revokes the presenting key, and returns
 * the new plaintext. No grace window: the authenticating key will be
 * rejected from the next request onward.
 *
 * Response:
 *   { old_key_id, new_key, new_key_id }
 */
interface HandleKeysRotateArgs {
  req: Request;
  kv: Deno.Kv;
}

async function handleKeysRotate(args: HandleKeysRotateArgs): Promise<Response> {
  const { req, kv } = args;

  if (req.method !== "POST") {
    throw new MethodNotAllowedError(["POST"]);
  }

  const identity = await authenticate(req, kv);
  const rotated = await rotateKey(kv, identity.key_id);
  if (rotated === null) {
    // Should not happen — authenticate() succeeded, so the key exists and
    // was not revoked. Treat as a transient race and surface 401 so the
    // caller reconsults its credentials.
    throw new UnauthenticatedError();
  }

  const body = {
    old_key_id: rotated.old.id,
    new_key: rotated.new.plaintext,
    new_key_id: rotated.new.record.id,
  };
  const response: ResponseWithMeta = new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": CONTENT_TYPE_JSON },
  }) as ResponseWithMeta;
  response._keyId = identity.key_id;
  return response;
}

/**
 * GET /usage — JSON quota snapshot for the authenticated customer.
 *
 * Response shape:
 *   {
 *     customer_id: string,
 *     tier: "free" | "pro",
 *     month: "YYYY-MM",
 *     used: number,
 *     limit: number,
 *     remaining: number,
 *     reset_at: number,        // Unix seconds at start of next UTC month
 *   }
 *
 * Read-only: does NOT bump the counter (validate bumps on its own hot path).
 * Grandfathered keys (customer_id=null) → 404. The endpoint is meaningless
 * for internal keys that bypass quota.
 */
interface HandleUsageArgs {
  req: Request;
  kv: Deno.Kv;
  config: Config;
  now: () => number;
}

async function handleUsage(args: HandleUsageArgs): Promise<Response> {
  const { req, kv, config, now } = args;

  if (req.method !== "GET") {
    throw new MethodNotAllowedError(["GET"]);
  }

  const identity = await authenticate(req, kv);

  const customerId = await lookupCustomerForKey(kv, identity.key_id);
  if (customerId === null) {
    // Internal/grandfathered key — the concept of monthly quota does not
    // apply. 404 rather than 200 with zeroes so a misconfigured client
    // cannot silently assume a 0-usage pro plan.
    throw new NotFoundError();
  }

  const customer = await lookupCustomerById(kv, customerId);
  if (customer === null) {
    // Denorm points at a deleted customer — internal integrity issue.
    throw new NotFoundError();
  }

  const limit = quotaFor(customer.tier, config);
  const nowDate = new Date(now());
  const snapshot = await peekUsage(kv, customer.id, {
    tier: customer.tier,
    limit,
    now: nowDate,
  });
  const month = formatMonth(currentMonthYYYYMM(nowDate));

  const body = {
    customer_id: customer.id,
    tier: snapshot.tier,
    month,
    used: snapshot.used,
    limit: snapshot.limit,
    remaining: snapshot.remaining,
    reset_at: snapshot.reset_at,
  };
  const response: ResponseWithMeta = new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPE_JSON,
      ...monthlyQuotaHeaders(snapshot),
    },
  }) as ResponseWithMeta;
  response._keyId = identity.key_id;
  return response;
}

/** "202604" -> "2026-04" for wire-level readability. */
function formatMonth(yyyymm: string): string {
  return `${yyyymm.slice(0, 4)}-${yyyymm.slice(4, 6)}`;
}

/**
 * POST /billing/webhook — Stripe-signed webhook.
 *
 * Pipeline:
 *   1. Only POST is permitted.
 *   2. Read the raw body as text (HMAC must see the exact bytes Stripe sent).
 *   3. Verify the signature. Any failure → 400 via StripeWebhookError.
 *   4. Parse the event into a typed StripeEvent.
 *   5. Idempotency: CAS-check `stripe_events:<event.id>`. If already seen,
 *      no-op (200). We set the marker BEFORE dispatch — this keeps a
 *      persistently-failing handler from being DoS'd by Stripe's retry
 *      machine. Operators investigate via logs + manual replay.
 *   6. Dispatch to `handleStripeEvent`. Handler errors surface as 500 so
 *      Stripe will retry (subject to (5) which prevents infinite loops).
 *
 * Response body is deliberately empty — Stripe only checks the status code.
 */
async function handleStripeWebhook(args: {
  req: Request;
  kv: Deno.Kv;
  config: Config;
  now: () => number;
}): Promise<Response> {
  const { req, kv, config, now } = args;
  if (req.method !== "POST") {
    throw new MethodNotAllowedError(["POST"]);
  }
  if (!config.stripeWebhookSecret) {
    throw new StripeWebhookError("Webhook secret not configured");
  }
  const rawBody = await req.text();
  const sigHeader = req.headers.get("stripe-signature");
  await verifyWebhookSignature(
    rawBody,
    sigHeader,
    config.stripeWebhookSecret,
    Math.floor(now() / 1000),
  );
  const event = constructEvent(rawBody);

  // Idempotency: atomic insert-if-absent. 7-day TTL covers Stripe's retry
  // window (~3 days) comfortably without holding marker keys forever.
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const cas = await kv.atomic()
    .check({ key: ["stripe_events", event.id], versionstamp: null })
    .set(["stripe_events", event.id], 1, { expireIn: SEVEN_DAYS_MS })
    .commit();
  if (!cas.ok) {
    // Already processed — Stripe retrying a successful delivery. Ack.
    return new Response(null, { status: 200 });
  }

  await handleStripeEvent(kv, event);
  return new Response(null, { status: 200 });
}

/**
 * Resolve the authenticated key's owning customer, charge one request against
 * that customer's monthly quota, and return the headers that advertise the
 * current state on the response.
 *
 * Returns an empty record (no headers) for grandfathered keys whose
 * `customer_id` is null — those keys predate the customer model and bypass
 * quota entirely, by design.
 *
 * Throws `QuotaExceededError` when the counter is already at the limit.
 */
async function enforceMonthlyQuota(args: {
  kv: Deno.Kv;
  keyId: string;
  config: Config;
  now: () => number;
}): Promise<Record<string, string>> {
  const { kv, keyId, config, now } = args;
  const customerId = await lookupCustomerForKey(kv, keyId);
  if (customerId === null) return {};

  const customer = await lookupCustomerById(kv, customerId);
  if (customer === null) {
    // Denorm entry points at a deleted customer — should not happen in
    // practice. Fail safe by letting the request through; the stale denorm
    // is an internal-data-integrity bug, not a client error.
    return {};
  }

  const limit = quotaFor(customer.tier, config);
  const snapshot: QuotaSnapshot = await incrementUsage(kv, customerId, {
    tier: customer.tier,
    limit,
    now: new Date(now()),
  });
  return monthlyQuotaHeaders(snapshot);
}

async function extractKaryotypeFromBody(
  req: Request,
  config: Config,
): Promise<string> {
  const ctype = req.headers.get("content-type") ?? "";
  if (!ctype.toLowerCase().includes("application/json")) {
    throw new BadRequestError("Content-Type must be application/json");
  }

  // Enforce body size limit BEFORE JSON parse.
  const declared = req.headers.get("content-length");
  if (declared !== null) {
    const n = Number(declared);
    if (Number.isFinite(n) && n > config.maxBodyBytes) {
      throw new BodyTooLargeError(config.maxBodyBytes);
    }
  }

  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.byteLength > config.maxBodyBytes) {
    throw new BodyTooLargeError(config.maxBodyBytes);
  }

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(buf));
  } catch {
    throw new BadRequestError("Body is not valid JSON");
  }
  if (
    body === null || typeof body !== "object" ||
    typeof (body as { karyotype?: unknown }).karyotype !== "string"
  ) {
    throw new BadRequestError("JSON body must include a 'karyotype' string");
  }
  const k = (body as { karyotype: string }).karyotype;
  if (k.length === 0) {
    throw new BadRequestError("'karyotype' must not be empty");
  }
  if (k.length > config.maxKaryotypeLength) {
    throw new BadRequestError(
      `'karyotype' exceeds max length (${config.maxKaryotypeLength})`,
    );
  }
  return k;
}

// ---------------------------------------------------------------------------
// Header + CORS helpers
// ---------------------------------------------------------------------------

function corsPreflight(req: Request, config: Config): Response {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = pickAllowedOrigin(origin, config);
  const requestedHeaders = req.headers.get("access-control-request-headers");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": requestedHeaders ??
      "Content-Type, Authorization, X-API-Key",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
  if (allowedOrigin !== null) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }
  return new Response(null, { status: 204, headers });
}

function pickAllowedOrigin(origin: string, config: Config): string | null {
  if (!origin) return null;
  if (config.allowedOrigins.length === 0) return "*";
  if (config.allowedOrigins.includes("*")) return "*";
  return config.allowedOrigins.includes(origin) ? origin : null;
}

interface ApplyHeadersArgs {
  req: Request;
  config: Config;
  rid: string;
  isHtml: boolean;
  isDashboard: boolean;
}

function applyResponseHeaders(
  res: Response,
  args: ApplyHeadersArgs,
): Response {
  const extras: Record<string, string> = {
    ...baseSecurityHeaders(),
    "X-Request-Id": args.rid,
  };

  // CORS on the actual response (not just preflight).
  const origin = args.req.headers.get("origin") ?? "";
  const allowed = pickAllowedOrigin(origin, args.config);
  if (allowed !== null) {
    extras["Access-Control-Allow-Origin"] = allowed;
    extras["Vary"] = "Origin";
  }

  if (args.isHtml) {
    // Dashboard needs the widened script-src for HTMX CDN; landing page
    // keeps the tighter policy.
    extras["Content-Security-Policy"] = args.isDashboard ? dashboardCspHeader() : htmlCspHeader();
  }

  const merged = mergeHeaders(res.headers, extras);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: merged,
  });
}

function isHtmlResponse(res: Response): boolean {
  const ct = res.headers.get("content-type") ?? "";
  return ct.toLowerCase().startsWith("text/html");
}

function isStaticRequest(path: string): boolean {
  return path.startsWith("/static/") || path.endsWith(".css") ||
    path.endsWith(".js") || path.endsWith(".ico") || path.endsWith(".png") ||
    path.endsWith(".svg");
}

function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    html: CONTENT_TYPE_HTML,
    css: "text/css; charset=utf-8",
    js: "application/javascript; charset=utf-8",
    json: CONTENT_TYPE_JSON,
    png: "image/png",
    svg: "image/svg+xml",
    ico: "image/x-icon",
  };
  return map[ext ?? ""] ?? "application/octet-stream";
}

async function handleExplainRoute(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/explain" || path === "/explain/") {
    return renderExplainIndex();
  }

  const signature = decodeURIComponent(path.substring("/explain/".length));
  const entry = (curatedData.signatures as any)[signature];

  if (!entry) {
    throw new NotFoundError();
  }

  return renderExplainEntry(signature, entry);
}

function renderExplainIndex(): Response {
  const signatures = Object.keys(curatedData.signatures);
  const listItems = signatures
    .map(
      (sig) => `<li><a href="/explain/${encodeURIComponent(sig)}">${escapeHtml(sig)}</a></li>`,
    )
    .join("");

  const html = renderSimplePage(
    "Curated ISCN Explanations",
    `
    <h2>Common Karyotypes</h2>
    <p>A library of human-curated explanations for common ISCN 2024 karyotype strings.</p>
    <ul class="explain-list">
      ${listItems}
    </ul>
    <style>
      .explain-list { margin-top: 1rem; }
      .explain-list li { margin-bottom: 0.5rem; }
      .explain-list a { color: var(--color-primary); text-decoration: none; font-family: var(--font-mono); }
      .explain-list a:hover { text-decoration: underline; }
    </style>
  `,
  );

  return new Response(html, {
    headers: { "Content-Type": CONTENT_TYPE_HTML },
  });
}

function renderExplainEntry(signature: string, entry: any): Response {
  const refs = entry.refs || {};
  let refsHtml = "";
  if (refs.omim?.length || refs.hpo?.length || refs.clinvar?.length) {
    refsHtml = "<h3>References</h3><ul class='refs'>";
    if (refs.omim) {
      refs.omim.forEach((id: string) => {
        refsHtml += `<li>OMIM: <a href="https://omim.org/entry/${id}" target="_blank">${id}</a></li>`;
      });
    }
    if (refs.hpo) {
      refs.hpo.forEach((id: string) => {
        refsHtml += `<li>HPO: <a href="https://hpo.jax.org/app/browse/term/${id}" target="_blank">${id}</a></li>`;
      });
    }
    refsHtml += "</ul>";
  }

  const html = renderSimplePage(
    `${signature} - ISCN Explanation`,
    `
    <nav><a href="/explain">&larr; All Explanations</a></nav>
    <h2 style="font-family: var(--font-mono); margin-top: 1rem;">${escapeHtml(signature)}</h2>
    <div class="explain-card">
      <p class="summary"><strong>${escapeHtml(entry.summary)}</strong></p>
      <p class="detail">${escapeHtml(entry.detail)}</p>
      ${entry.citation ? `<p class="citation"><em>Source: ISCN 2024 § ${entry.citation.section}${entry.citation.page ? ", p. " + entry.citation.page : ""}</em></p>` : ""}
    </div>
    ${refsHtml}
    <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--color-border);">
      <a href="/?karyotype=${encodeURIComponent(signature)}" class="button">Validate this Karyotype</a>
    </div>
    <style>
      nav a { color: var(--color-text-muted); text-decoration: none; font-size: 0.875rem; }
      .explain-card { margin: 1.5rem 0; padding: 1.5rem; background: var(--color-bg); border-radius: var(--radius); }
      .summary { font-size: 1.125rem; margin-bottom: 1rem; }
      .detail { line-height: 1.6; margin-bottom: 1rem; }
      .citation { font-size: 0.875rem; color: var(--color-text-muted); }
      .refs { margin: 1rem 0; }
      .refs li { font-size: 0.875rem; margin-bottom: 0.25rem; }
      .button { display: inline-block; background: var(--color-primary); color: white; padding: 0.5rem 1rem; border-radius: 4px; text-decoration: none; }
    </style>
  `,
  );

  return new Response(html, {
    headers: { "Content-Type": CONTENT_TYPE_HTML },
  });
}

function renderSimplePage(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ISCN Authenticator</title>
  <style>
    :root {
      --color-bg: #f8f9fa;
      --color-surface: #ffffff;
      --color-text: #212529;
      --color-text-muted: #6c757d;
      --color-primary: #0d6efd;
      --color-border: #dee2e6;
      --font-mono: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
      --radius: 8px;
    }
    body { font-family: system-ui, sans-serif; background: var(--color-bg); color: var(--color-text); margin: 0; padding: 2rem 1rem; }
    .container { max-width: 800px; margin: 0 auto; background: var(--color-surface); padding: 2rem; border-radius: var(--radius); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { margin-top: 0; font-size: 1.5rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.5rem; }
    a { color: var(--color-primary); }
  </style>
</head>
<body>
  <div class="container">
    <h1>ISCN Authenticator</h1>
    <main>${content}</main>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
