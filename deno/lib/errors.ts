/**
 * Typed errors + safe HTTP response mapping.
 *
 * Handlers throw these; a top-level catch calls `errorToResponse()` which
 * maps each type to a clean `{ error, message, request_id }` JSON body.
 * Internal errors are masked — `message` never leaks stack traces or
 * implementation detail to clients.
 */

export type ErrorCode =
  | "unauthenticated"
  | "rate_limited"
  | "quota_exceeded"
  | "body_too_large"
  | "invalid_request"
  | "invalid_signup"
  | "not_found"
  | "method_not_allowed"
  | "stripe_error"
  | "internal";

export interface ErrorPayload {
  error: ErrorCode;
  message: string;
  request_id: string;
}

/** Base class — every app-level error carries an HTTP status and a public message. */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  /** Optional headers to merge into the response (e.g. Retry-After, WWW-Authenticate). */
  readonly headers: Record<string, string>;

  constructor(
    code: ErrorCode,
    status: number,
    message: string,
    headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.headers = headers;
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Missing or invalid API key") {
    super("unauthenticated", 401, message, {
      "WWW-Authenticate": 'Bearer realm="iscn", charset="UTF-8"',
    });
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number, message = "Rate limit exceeded") {
    super("rate_limited", 429, message, {
      "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))),
    });
  }
}

/**
 * Monthly quota exhausted — distinct from per-minute rate limiting.
 * The 402 status is chosen deliberately to let integrators distinguish
 * "try again in a second" (429) from "upgrade your plan" (402).
 */
export class QuotaExceededError extends AppError {
  constructor(
    limit: number,
    resetAt: number,
    message = "Monthly request quota exceeded",
  ) {
    super("quota_exceeded", 402, message, {
      "X-Monthly-Quota-Limit": String(limit),
      "X-Monthly-Quota-Remaining": "0",
      "X-Monthly-Quota-Reset": String(resetAt),
    });
  }
}

export class BodyTooLargeError extends AppError {
  constructor(maxBytes: number) {
    super("body_too_large", 413, `Request body exceeds ${maxBytes} bytes`);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Invalid request") {
    super("invalid_request", 400, message);
  }
}

/**
 * Signup-specific 400: duplicate email, malformed email, or missing field.
 * Kept distinct from `invalid_request` so the UI can surface a targeted
 * message ("email already in use") without scraping the generic code.
 */
export class InvalidSignupError extends AppError {
  constructor(message = "Invalid signup") {
    super("invalid_signup", 400, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super("not_found", 404, message);
  }
}

export class MethodNotAllowedError extends AppError {
  constructor(allowed: string[]) {
    super("method_not_allowed", 405, "Method not allowed", {
      Allow: allowed.join(", "),
    });
  }
}

/**
 * Stripe webhook rejection (400). Distinct from `invalid_request` so log
 * alerts can target webhook signature / payload problems specifically — a
 * surge of these usually means a rotated webhook secret or a bad deploy.
 */
export class StripeWebhookError extends AppError {
  constructor(message = "Stripe webhook rejected") {
    super("stripe_error", 400, message);
  }
}

/**
 * Map any thrown value to an HTTP Response.
 *
 * - `AppError` subclasses round-trip their status/headers/public message.
 * - Unknown errors become a 500 with generic `internal` code; the full error
 *   is expected to be logged by the caller, keyed to the same request_id.
 */
export function errorToResponse(
  err: unknown,
  requestId: string,
  opts: { debug?: boolean } = {},
): Response {
  if (err instanceof AppError) {
    return jsonError(err.status, {
      error: err.code,
      message: err.message,
      request_id: requestId,
    }, err.headers);
  }

  const message = opts.debug && err instanceof Error ? err.message : "Internal server error";

  return jsonError(500, {
    error: "internal",
    message,
    request_id: requestId,
  });
}

function jsonError(
  status: number,
  body: ErrorPayload,
  extraHeaders: Record<string, string> = {},
): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  return new Response(JSON.stringify(body), { status, headers });
}
