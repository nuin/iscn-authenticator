/** Route dispatch and unauthenticated HTTP endpoints. */
import type { BuildHandlerOptions } from "./middleware.ts";
import {
  BadRequestError,
  MethodNotAllowedError,
  NotFoundError,
  StripeWebhookError,
} from "./errors.ts";
import { handleKeysRotate, handleUsage, handleValidate } from "./api_routes.ts";
import { handleDashboardRoute, isDashboardPath } from "./dashboard.ts";
import { handleSignupRoute, isSignupPath } from "./signup.ts";
import { handleAboutPage, handleDocsPage, handlePricingPage } from "./pages.ts";
import { handleExplainRoute } from "./explain_pages.ts";
import { createOpenApiHandler } from "./openapi.ts";
import { sha256Hex } from "./keys.ts";
import { constructEvent, verifyWebhookSignature } from "./stripe.ts";
import { handleStripeEvent } from "./webhooks.ts";
import type { Config } from "./config.ts";

const CONTENT_TYPE_JSON = "application/json; charset=utf-8";
const CONTENT_TYPE_HTML = "text/html; charset=utf-8";

interface RouteContext {
  rid: string;
  ip: string | null;
}

export function createRouter(opts: BuildHandlerOptions, now: () => number) {
  const { kv, config, staticHtml, staticDir, staticAssets, openapiYaml, logSink } = opts;
  const openapiHandler = openapiYaml ? createOpenApiHandler(openapiYaml) : null;

  return async function dispatch(req: Request, { rid, ip }: RouteContext): Promise<Response> {
    const path = new URL(req.url).pathname;
    switch (path) {
      case "/health":
        return handleHealth();
      case "/openapi.json":
        if (req.method !== "GET") throw new MethodNotAllowedError(["GET"]);
        if (!openapiHandler) throw new NotFoundError();
        return openapiHandler();
      case "/validate":
        return await handleValidate({ req, kv, config, rid, now });
      case "/keys/rotate":
        return await handleKeysRotate({ req, kv });
      case "/usage":
        return await handleUsage({ req, kv, config, now });
      case "/billing/webhook":
        return await handleStripeWebhook({ req, kv, config, now });
    }
    if (isDashboardPath(path)) return await handleDashboardRoute(req, { kv, config });
    if (isSignupPath(path)) return await handleSignupRoute(req, { kv, config, ip, now });
    switch (path) {
      case "/pricing":
        return await handlePricingPage();
      case "/docs":
      case "/api":
        return await handleDocsPage();
      case "/about":
        return await handleAboutPage();
      case "/explain/miss":
        return await handleExplainMiss(req, { logSink, rid });
    }
    if (path === "/explain" || path.startsWith("/explain/")) {
      return await handleExplainRoute(req);
    }
    if (staticAssets && staticAssets[path]) {
      return new Response(staticAssets[path], {
        status: 200,
        headers: { "Content-Type": contentTypeFor(path) },
      });
    }
    if (path === "/" || path === "/index.html") {
      return await handleStaticIndex({ staticHtml, staticDir });
    }
    if (staticDir && isStaticRequest(path)) return await handleStaticFile(path, staticDir);
    throw new NotFoundError();
  };
}

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
