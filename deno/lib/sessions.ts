/**
 * HMAC-signed session cookies backed by Deno KV.
 *
 * A session cookie has the shape:
 *
 *   iscn_session=<session_id>.<hmac_hex>
 *
 * where `<hmac_hex>` is HMAC-SHA256(`<session_id>`, SESSION_SECRET) encoded
 * as lowercase hex. Signing lets us reject forged cookie values before we
 * pay for the KV round-trip. The KV lookup then confirms the session is
 * still live (unrevoked, unexpired).
 *
 * Design notes:
 *   - Session ids are `s_<16 random bytes hex>` (32 hex chars, 128 bits of
 *     entropy — same bar as the API keys).
 *   - Sessions live in KV at `sessions:<id>` with a 7-day `expireIn`; we
 *     never rely solely on the `expires_at` field because KV TTL means a
 *     stale record cannot linger past expiry even if a bug skipped the
 *     explicit check.
 *   - `validateSession` does a constant-time HMAC compare, then checks KV,
 *     then checks `expires_at` as defense-in-depth.
 *   - `destroySession` is the only way to invalidate before expiry; there
 *     is no in-flight secret rotation (rotating `SESSION_SECRET` voids all
 *     sessions, which is acceptable for the M2 scale).
 */

export interface SessionRecord {
  /** `s_<32 hex>` */
  id: string;
  customer_id: string;
  /** ISO-8601 */
  created_at: string;
  /** ISO-8601 */
  expires_at: string;
}

export interface CreatedSession {
  record: SessionRecord;
  /** The value of the Set-Cookie header (name=value; attrs). */
  set_cookie: string;
  /** Just the cookie value (`<id>.<hmac>`) — useful for tests + callers that
   * set the Set-Cookie header themselves. */
  cookie_value: string;
}

export const SESSION_COOKIE_NAME = "iscn_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const KV_PREFIX = "sessions";

export interface CreateSessionOptions {
  /** Override now() for deterministic tests. */
  now?: () => Date;
  /** Override the TTL (tests). Default 7 days. */
  ttlMs?: number;
  /** Emit `Secure` on the Set-Cookie attribute. Defaults to true in prod. */
  secure?: boolean;
}

/** Create a session row in KV and return a signed Set-Cookie string. */
export async function createSession(
  kv: Deno.Kv,
  customerId: string,
  secret: string,
  opts: CreateSessionOptions = {},
): Promise<CreatedSession> {
  if (!customerId) throw new Error("sessions: customerId is required");
  if (!secret) throw new Error("sessions: SESSION_SECRET is required");

  const ttl = opts.ttlMs ?? SESSION_TTL_MS;
  const nowDate = (opts.now ?? (() => new Date()))();
  const id = `s_${randomHex(16)}`;
  const record: SessionRecord = {
    id,
    customer_id: customerId,
    created_at: nowDate.toISOString(),
    expires_at: new Date(nowDate.getTime() + ttl).toISOString(),
  };

  await kv.set([KV_PREFIX, id], record, { expireIn: ttl });

  const hmac = await signHmacHex(secret, id);
  const cookieValue = `${id}.${hmac}`;
  const attrs = [
    `${SESSION_COOKIE_NAME}=${cookieValue}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(ttl / 1000)}`,
  ];
  if (opts.secure !== false) attrs.push("Secure");

  return {
    record,
    set_cookie: attrs.join("; "),
    cookie_value: cookieValue,
  };
}

/**
 * Look up a session by the raw cookie value (`<id>.<hmac>`).
 * Returns the SessionRecord if:
 *   1. The cookie value parses.
 *   2. The HMAC matches (constant-time compare).
 *   3. A row exists in KV.
 *   4. The row's `expires_at` is still in the future.
 * Returns null on any failure — no differentiation leaks to the caller.
 */
export async function validateSessionCookie(
  kv: Deno.Kv,
  cookieValue: string,
  secret: string,
  opts: { now?: () => Date } = {},
): Promise<SessionRecord | null> {
  if (!secret) return null;
  const parts = splitCookie(cookieValue);
  if (parts === null) return null;
  const { id, sig } = parts;

  const expectedSig = await signHmacHex(secret, id);
  if (!timingSafeEqualHex(expectedSig, sig)) return null;

  const entry = await kv.get<SessionRecord>([KV_PREFIX, id]);
  if (entry.value === null) return null;

  const now = (opts.now ?? (() => new Date()))();
  if (new Date(entry.value.expires_at).getTime() <= now.getTime()) return null;

  return entry.value;
}

/**
 * Convenience: pull the session cookie out of the request's Cookie header
 * and validate in one call.
 */
export async function validateSessionFromRequest(
  req: Request,
  kv: Deno.Kv,
  secret: string,
  opts: { now?: () => Date } = {},
): Promise<SessionRecord | null> {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;
  const value = readCookie(cookieHeader, SESSION_COOKIE_NAME);
  if (value === null) return null;
  return await validateSessionCookie(kv, value, secret, opts);
}

/** Delete a session row by id. Safe to call for unknown ids (no-op). */
export async function destroySession(
  kv: Deno.Kv,
  sessionId: string,
): Promise<void> {
  if (!sessionId) return;
  await kv.delete([KV_PREFIX, sessionId]);
}

/**
 * Build the Set-Cookie header that clears an existing session cookie.
 * Use after `destroySession` on logout, or whenever validation failed and
 * you want to prompt the client to re-authenticate cleanly.
 */
export function clearSessionCookie(opts: { secure?: boolean } = {}): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (opts.secure !== false) attrs.push("Secure");
  return attrs.join("; ");
}

// ---------------------------------------------------------------------------
// Internal: cookie parsing + hex HMAC helpers
// ---------------------------------------------------------------------------

function splitCookie(cookieValue: string): { id: string; sig: string } | null {
  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0 || dot === cookieValue.length - 1) return null;
  const id = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  if (!/^s_[0-9a-f]+$/.test(id)) return null;
  if (!/^[0-9a-f]+$/.test(sig)) return null;
  return { id, sig };
}

/** Read a named cookie out of a raw Cookie header. Returns null if absent. */
export function readCookie(header: string, name: string): string | null {
  const needle = `${name}=`;
  for (const raw of header.split(";")) {
    const trimmed = raw.trim();
    if (trimmed.startsWith(needle)) return trimmed.slice(needle.length);
  }
  return null;
}

async function signHmacHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return bytesToHex(new Uint8Array(buf));
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function randomHex(numBytes: number): string {
  const buf = new Uint8Array(numBytes);
  crypto.getRandomValues(buf);
  return bytesToHex(buf);
}

function bytesToHex(buf: Uint8Array): string {
  let out = "";
  for (const b of buf) out += b.toString(16).padStart(2, "0");
  return out;
}
