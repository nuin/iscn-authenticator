/** Authenticated API routes: validation, key rotation, and monthly usage. */
import type { Config } from "./config.ts";
import {
  BadRequestError,
  BodyTooLargeError,
  MethodNotAllowedError,
  NotFoundError,
  RateLimitError,
  UnauthenticatedError,
} from "./errors.ts";
import { authenticate } from "./auth.ts";
import { checkAndConsume, tokenBucketHeaders } from "./token_bucket.ts";
import { lookupCustomerForKey, rotateKey, touchKey } from "./keys.ts";
import { lookupCustomerById } from "./customers.ts";
import {
  currentMonthYYYYMM,
  incrementUsage,
  monthlyQuotaHeaders,
  peekUsage,
  quotaFor,
  type QuotaSnapshot,
} from "./quota.ts";
import { validateKaryotypeNative } from "../../packages/core/src/validate.ts";
import { explain } from "../../packages/core/src/index.ts";

const CONTENT_TYPE_JSON = "application/json; charset=utf-8";

interface HandleValidateArgs {
  req: Request;
  kv: Deno.Kv;
  config: Config;
  rid: string;
  now: () => number;
}

/** Internal identity metadata is read for logging before response headers are rebuilt. */
export type ResponseWithMeta = Response & { _keyId?: string };

export async function handleValidate(args: HandleValidateArgs): Promise<Response> {
  const { req, kv, config, now } = args;

  if (req.method !== "GET" && req.method !== "POST") {
    throw new MethodNotAllowedError(["GET", "POST"]);
  }

  // 1. Auth (throws UnauthenticatedError on any failure path).
  const identity = await authenticate(req, kv);

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

interface HandleKeysRotateArgs {
  req: Request;
  kv: Deno.Kv;
}

export async function handleKeysRotate(args: HandleKeysRotateArgs): Promise<Response> {
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

interface HandleUsageArgs {
  req: Request;
  kv: Deno.Kv;
  config: Config;
  now: () => number;
}

export async function handleUsage(args: HandleUsageArgs): Promise<Response> {
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

function formatMonth(yyyymm: string): string {
  return `${yyyymm.slice(0, 4)}-${yyyymm.slice(4, 6)}`;
}

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
