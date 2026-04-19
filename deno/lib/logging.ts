/**
 * Structured JSON logging.
 *
 * One JSON object per completed request, emitted to stdout. Deno Deploy
 * collects stdout automatically; operators can ship the same stream to
 * Axiom/Logtail/Datadog post-M1 without changing this module.
 *
 * Karyotype payloads are NEVER logged here — conservative default for the
 * forthcoming HIPAA narrative. If diagnostic logging is ever needed, add a
 * separate opt-in path; do not relax this default.
 */

import type { ErrorCode } from "./errors.ts";

export interface RequestLog {
  ts: string;
  level: "info" | "warn" | "error";
  request_id: string;
  ip: string | null;
  method: string;
  path: string;
  status: number;
  latency_ms: number;
  key_id: string | null;
  user_agent: string | null;
  error_code: ErrorCode | null;
}

/** Generate a request id. Uses `crypto.randomUUID` (built into Deno). */
export function requestId(): string {
  return crypto.randomUUID();
}

/**
 * Emit a completed-request log line as JSON to stdout.
 *
 * `sink` is injectable for tests.
 */
export function logRequest(
  entry: RequestLog,
  sink: (line: string) => void = (line) => console.log(line),
): void {
  sink(JSON.stringify(entry));
}

/** Extract a client IP from standard proxy headers, falling back to null. */
export function clientIp(req: Request, connInfo?: { hostname?: string }): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // First hop is the client; rest are intermediate proxies.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return connInfo?.hostname ?? null;
}
