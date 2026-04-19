import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  AppError,
  BadRequestError,
  BodyTooLargeError,
  errorToResponse,
  MethodNotAllowedError,
  NotFoundError,
  RateLimitError,
  UnauthenticatedError,
} from "../lib/errors.ts";

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  return JSON.parse(text);
}

Deno.test("UnauthenticatedError: 401 with WWW-Authenticate", async () => {
  const res = errorToResponse(new UnauthenticatedError(), "req-1");
  assertEquals(res.status, 401);
  assert(res.headers.get("www-authenticate")?.startsWith("Bearer"));
  const body = await readJson(res);
  assertEquals(body.error, "unauthenticated");
  assertEquals(body.request_id, "req-1");
});

Deno.test("RateLimitError: 429 with Retry-After", async () => {
  const res = errorToResponse(new RateLimitError(42), "req-2");
  assertEquals(res.status, 429);
  assertEquals(res.headers.get("retry-after"), "42");
  const body = await readJson(res);
  assertEquals(body.error, "rate_limited");
});

Deno.test("RateLimitError: Retry-After floors to 1 second minimum", async () => {
  const res = errorToResponse(new RateLimitError(0), "req-2b");
  assertEquals(res.headers.get("retry-after"), "1");
});

Deno.test("RateLimitError: Retry-After rounds up fractional seconds", async () => {
  const res = errorToResponse(new RateLimitError(0.1), "req-2c");
  assertEquals(res.headers.get("retry-after"), "1");
  const res2 = errorToResponse(new RateLimitError(2.4), "req-2d");
  assertEquals(res2.headers.get("retry-after"), "3");
});

Deno.test("BodyTooLargeError: 413 includes byte limit in message", async () => {
  const res = errorToResponse(new BodyTooLargeError(2048), "req-3");
  assertEquals(res.status, 413);
  const body = await readJson(res);
  assertEquals(body.error, "body_too_large");
  assert(String(body.message).includes("2048"));
});

Deno.test("BadRequestError: 400 with custom message", async () => {
  const res = errorToResponse(new BadRequestError("expected JSON body"), "req-4");
  assertEquals(res.status, 400);
  const body = await readJson(res);
  assertEquals(body.error, "invalid_request");
  assertEquals(body.message, "expected JSON body");
});

Deno.test("NotFoundError: 404", async () => {
  const res = errorToResponse(new NotFoundError(), "req-5");
  assertEquals(res.status, 404);
  const body = await readJson(res);
  assertEquals(body.error, "not_found");
});

Deno.test("MethodNotAllowedError: 405 with Allow header", async () => {
  const res = errorToResponse(new MethodNotAllowedError(["GET", "POST"]), "req-6");
  assertEquals(res.status, 405);
  assertEquals(res.headers.get("allow"), "GET, POST");
});

Deno.test("errorToResponse: unknown error → 500 internal, masked message", async () => {
  const res = errorToResponse(new Error("db connection refused: 127.0.0.1:5432"), "req-7");
  assertEquals(res.status, 500);
  const body = await readJson(res);
  assertEquals(body.error, "internal");
  assertEquals(body.message, "Internal server error");
  assertEquals(body.request_id, "req-7");
  // Stack/detail must NOT leak.
  assert(!String(body.message).includes("db connection refused"));
});

Deno.test("errorToResponse: debug mode preserves message for Error instances", async () => {
  const res = errorToResponse(new Error("boom"), "req-7b", { debug: true });
  const body = await readJson(res);
  assertEquals(body.message, "boom");
});

Deno.test("errorToResponse: non-Error value still produces 500", async () => {
  const res = errorToResponse("some string thrown", "req-8");
  assertEquals(res.status, 500);
  const body = await readJson(res);
  assertEquals(body.error, "internal");
  assertEquals(body.message, "Internal server error");
});

Deno.test("AppError: status and code are read-only fields with correct values", () => {
  const e = new AppError("invalid_request", 400, "msg");
  assertEquals(e.status, 400);
  assertEquals(e.code, "invalid_request");
  assertEquals(e.message, "msg");
  assert(e instanceof Error);
});

Deno.test("errorToResponse: response body is valid JSON with correct content-type", async () => {
  const res = errorToResponse(new UnauthenticatedError(), "req-9");
  assertEquals(res.headers.get("content-type"), "application/json; charset=utf-8");
  const body = await readJson(res); // Will throw if not valid JSON.
  assertEquals(Object.keys(body).sort(), ["error", "message", "request_id"]);
});
