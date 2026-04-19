/**
 * Extract and validate an API key from an incoming Request.
 *
 * Accepts two credential forms (both common in the wild):
 *   - Authorization: Bearer <key>
 *   - X-API-Key: <key>
 *
 * If both are present, Authorization wins. Bearer parsing is case-insensitive
 * on the scheme per RFC 7235 §2.1.
 *
 * On success: returns `{ key_id, label }`. Callers should pass this down via
 * the request context and fire `touchKey(kv, key_id)` without awaiting so the
 * response is not blocked by the last_used_at update.
 *
 * On failure: throws `UnauthenticatedError` (maps to 401 via errors.ts).
 */

import { UnauthenticatedError } from "./errors.ts";
import { lookupKeyByPlaintext } from "./keys.ts";

export interface AuthIdentity {
  key_id: string;
  label: string;
}

const BEARER_RE = /^Bearer\s+(\S.*)$/i;

/** Extract the raw plaintext credential from the request headers, if any. */
export function extractCredential(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth) {
    const match = BEARER_RE.exec(auth.trim());
    if (match) return match[1].trim();
    // Header present but not a Bearer token — reject as malformed rather than
    // falling through to X-API-Key, so clients get a clear signal.
    return null;
  }
  const xkey = req.headers.get("x-api-key");
  if (xkey) return xkey.trim();
  return null;
}

/** Does the request carry a properly-formatted Authorization header of any kind? */
export function hasAuthorizationHeader(req: Request): boolean {
  return req.headers.has("authorization") || req.headers.has("x-api-key");
}

/**
 * Authenticate a request against the KV-backed key store.
 * Throws `UnauthenticatedError` if missing, malformed, unknown, or revoked.
 */
export async function authenticate(
  req: Request,
  kv: Deno.Kv,
): Promise<AuthIdentity> {
  const plaintext = extractCredential(req);
  if (plaintext === null || plaintext === "") {
    throw new UnauthenticatedError();
  }
  const record = await lookupKeyByPlaintext(kv, plaintext);
  if (record === null) {
    // Generic message — we intentionally do NOT differentiate
    // "unknown", "malformed", or "revoked" to avoid giving attackers
    // a free probe for key-validity state.
    throw new UnauthenticatedError();
  }
  return { key_id: record.id, label: record.label };
}
