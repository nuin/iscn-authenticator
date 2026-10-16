/** Shared request lifecycle: CORS, routing, error handling, security headers, and logs. */
import type { Config } from "./config.ts";
import { AppError, type ErrorCode, errorToResponse } from "./errors.ts";
import {
  baseSecurityHeaders,
  dashboardCspHeader,
  htmlCspHeader,
  mergeHeaders,
  scalarCspHeader,
} from "./security_headers.ts";
import { clientIp, logRequest, requestId, type RequestLog } from "./logging.ts";
import { isDashboardPath } from "./dashboard.ts";
import { createRouter } from "./middleware_routes.ts";
import type { ResponseWithMeta } from "./api_routes.ts";

export interface BuildHandlerOptions {
  kv: Deno.Kv;
  config: Config;
  /** Embedded HTML for Deno Deploy entrypoint (main.ts). */
  staticHtml?: string;
  /** Filesystem directory for local dev (server.ts). Served on GET /. */
  staticDir?: string;
  /** Embedded static assets (path -> content). */
  staticAssets?: Record<string, string>;
  /**
   * Raw `docs/openapi.yaml` text. When set, served at `GET /openapi.json`
   * (parsed and cached on first request). Both `main.ts` and `server.ts`
   * pass the same document; tests/openapi_test.ts asserts they stay
   * aligned with the live route table.
   */
  openapiYaml?: string;
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

/** Build the composed request handler. */
export function buildHandler(opts: BuildHandlerOptions): AppHandler {
  const { config, logSink } = opts;
  const now = opts.now ?? (() => Date.now());
  const errorSink = opts.errorSink ??
    ((rid: string, err: unknown) => console.error(`[${rid}] uncaught error:`, err));
  const dispatch = createRouter(opts, now);

  return async function handler(req, info) {
    const rid = requestId();
    const startedAt = now();
    const path = new URL(req.url).pathname;
    const remoteAddr = (info as { remoteAddr?: { hostname?: string } } | undefined)
      ?.remoteAddr;
    const ip = clientIp(req, remoteAddr);
    let keyId: string | undefined;
    let errorCode: ErrorCode | undefined;
    let response: Response;

    try {
      response = req.method === "OPTIONS"
        ? corsPreflight(req, config)
        : await dispatch(req, { rid, ip });
      keyId = (response as ResponseWithMeta)._keyId;
    } catch (err) {
      errorCode = err instanceof AppError ? err.code : "internal";
      if (!(err instanceof AppError)) errorSink(rid, err);
      response = errorToResponse(err, rid, { debug: config.debugErrors });
    }

    response = applyResponseHeaders(response, {
      req,
      config,
      rid,
      isHtml: isHtmlResponse(response),
      isDashboard: isDashboardPath(path),
      isDocs: path === "/docs" || path === "/api",
    });
    const status = response.status;
    const logEntry: RequestLog = {
      ts: new Date(startedAt).toISOString(),
      level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
      request_id: rid,
      ip,
      method: req.method,
      path,
      status,
      latency_ms: Math.max(0, now() - startedAt),
      key_id: keyId ?? null,
      user_agent: req.headers.get("user-agent"),
      error_code: errorCode ?? null,
    };
    logRequest(logEntry, logSink);
    return response;
  };
}

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
  isDocs: boolean;
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
    // CSP varies by route audience:
    //   - /docs (Scalar API reference) needs cdn.jsdelivr.net for its bundle
    //   - /dashboard/* needs unpkg.com for the pinned HTMX script
    //   - everything else uses the tight landing-page policy
    extras["Content-Security-Policy"] = args.isDocs
      ? scalarCspHeader()
      : args.isDashboard
      ? dashboardCspHeader()
      : htmlCspHeader();
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
