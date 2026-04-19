import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import { clientIp, logRequest, requestId, type RequestLog } from "../lib/logging.ts";

Deno.test("requestId: returns a UUID v4 string", () => {
  const id = requestId();
  // Loose UUID v4 pattern: 8-4-4-4-12 hex with version nibble 4.
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert(re.test(id), `not a UUID v4: ${id}`);
});

Deno.test("requestId: returns distinct values", () => {
  const a = requestId();
  const b = requestId();
  assert(a !== b);
});

Deno.test("logRequest: emits one JSON line with all fields", () => {
  const captured: string[] = [];
  const entry: RequestLog = {
    ts: "2026-04-18T12:34:56.789Z",
    level: "info",
    request_id: "req-xyz",
    ip: "1.2.3.4",
    method: "POST",
    path: "/validate",
    status: 200,
    latency_ms: 3,
    key_id: "k_abc",
    user_agent: "curl/8.0",
    error_code: null,
  };
  logRequest(entry, (line) => captured.push(line));
  assertEquals(captured.length, 1);
  const parsed = JSON.parse(captured[0]);
  assertEquals(parsed, entry);
});

Deno.test("logRequest: karyotype payload is never included in log shape", () => {
  const captured: string[] = [];
  const entry: RequestLog = {
    ts: "2026-04-18T12:34:56.789Z",
    level: "info",
    request_id: "req-1",
    ip: null,
    method: "GET",
    path: "/validate",
    status: 200,
    latency_ms: 1,
    key_id: "k_1",
    user_agent: null,
    error_code: null,
  };
  logRequest(entry, (line) => captured.push(line));
  const parsed = JSON.parse(captured[0]);
  // Shape contract: no field called karyotype, body, or input.
  for (const forbidden of ["karyotype", "body", "input", "payload"]) {
    assert(!(forbidden in parsed), `log must not include ${forbidden}`);
  }
});

Deno.test("clientIp: prefers x-forwarded-for first hop", () => {
  const req = new Request("http://x", {
    headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1, 10.0.0.2" },
  });
  assertEquals(clientIp(req), "1.2.3.4");
});

Deno.test("clientIp: falls back to x-real-ip", () => {
  const req = new Request("http://x", { headers: { "x-real-ip": "5.6.7.8" } });
  assertEquals(clientIp(req), "5.6.7.8");
});

Deno.test("clientIp: falls back to connInfo.hostname", () => {
  const req = new Request("http://x");
  assertEquals(clientIp(req, { hostname: "9.9.9.9" }), "9.9.9.9");
});

Deno.test("clientIp: returns null when nothing is available", () => {
  const req = new Request("http://x");
  assertEquals(clientIp(req), null);
});

Deno.test("clientIp: ignores empty x-forwarded-for leading comma", () => {
  const req = new Request("http://x", {
    headers: { "x-forwarded-for": ", 10.0.0.1" },
  });
  // First token is empty, so we get null (not "" or "10.0.0.1").
  // Behavior choice: conservative — do not trust an unknown-shape header.
  assertEquals(clientIp(req), null);
});
