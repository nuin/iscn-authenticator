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
  MethodNotAllowedError,
  NotFoundError,
  errorToResponse,
} from "./errors.ts";
import type { ErrorCode } from "./errors.ts";
import { authenticate } from "./auth.ts";
import { RateLimitError } from "./errors.ts";
import { checkRateLimit, rateLimitHeaders } from "./ratelimit.ts";
import { touchKey } from "./keys.ts";
import {
  baseSecurityHeaders,
  htmlCspHeader,
  mergeHeaders,
} from "./security_headers.ts";
import { clientIp, logRequest, requestId } from "./logging.ts";
import type { RequestLog } from "./logging.ts";
import { validateKaryotypeNative } from "../../packages/core/src/validate.ts";

export interface BuildHandlerOptions {
  kv: Deno.Kv;
  config: Config;
  /** Embedded HTML for Deno Deploy entrypoint (main.ts). */
  staticHtml?: string;
  /** Filesystem directory for local dev (server.ts). Served on GET /. */
  staticDir?: string;
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
  const { kv, config, staticHtml, staticDir } = opts;
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

  // 2. Rate limit (counter bumps BEFORE we do any work).
  const rl = await checkRateLimit(kv, identity.key_id, {
    limit: config.rateLimitPerMin,
    windowSeconds: 60,
    now,
  });
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) {
    const err = new RateLimitError(rl.retry_after);
    // Surface X-RateLimit-* headers even on 429.
    Object.assign(err.headers, rlHeaders);
    throw err;
  }

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

  const response: ResponseWithMeta = new Response(
    JSON.stringify(result),
    {
      status: 200,
      headers: {
        "Content-Type": CONTENT_TYPE_JSON,
        ...rlHeaders,
      },
    },
  ) as ResponseWithMeta;
  response._keyId = identity.key_id;
  return response;
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
    extras["Content-Security-Policy"] = htmlCspHeader();
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
