/**
 * API key CRUD against Deno KV.
 *
 * Storage schema:
 *   ["keys", <sha256-hex>]    → ApiKeyRecord          primary store (lookup by plaintext)
 *   ["keys_index", <id>]      → <sha256-hex>          reverse index (lookup by id)
 *
 * Plaintext is never persisted. `createKey()` returns it once; callers must
 * show it to the operator at that moment or it is unrecoverable.
 *
 * Key format:  iscn_live_<32 hex>  or  iscn_test_<32 hex>
 * The literal `iscn_live_` / `iscn_test_` prefix is deliberate — GitHub and
 * GitLab secret scanners detect this shape and flag leaked keys.
 */

export type KeyEnvironment = "live" | "test";

export interface ApiKeyRecord {
  id: string;
  label: string;
  env: KeyEnvironment;
  created_at: string; // ISO 8601
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface CreatedKey {
  record: ApiKeyRecord;
  /** The plaintext token — shown to the operator once, never stored. */
  plaintext: string;
}

const KEY_PREFIX = "iscn_";
const KEY_SUFFIX_HEX_LEN = 32;

/** SHA-256 → lowercase hex. Uses Web Crypto (built into Deno). */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return hex(new Uint8Array(digest));
}

function hex(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += b.toString(16).padStart(2, "0");
  return s;
}

function randomHex(byteCount: number): string {
  const buf = new Uint8Array(byteCount);
  crypto.getRandomValues(buf);
  return hex(buf);
}

/** Generate a new opaque id for the public-facing reference (safe to log). */
export function newKeyId(): string {
  // 6 bytes → 12 hex; prefix `k_` makes it unambiguous in logs.
  return `k_${randomHex(6)}`;
}

function newPlaintext(env: KeyEnvironment): string {
  // 16 bytes → 32 hex characters of entropy.
  return `${KEY_PREFIX}${env}_${randomHex(16)}`;
}

/** Shape check for a plaintext token. Cheap gate before hashing + KV read. */
export function isWellFormedKey(plaintext: string): boolean {
  if (typeof plaintext !== "string") return false;
  for (const env of ["live", "test"] as const) {
    const prefix = `${KEY_PREFIX}${env}_`;
    if (plaintext.startsWith(prefix)) {
      const suffix = plaintext.slice(prefix.length);
      return suffix.length === KEY_SUFFIX_HEX_LEN && /^[0-9a-f]+$/i.test(suffix);
    }
  }
  return false;
}

/**
 * Create a new key.
 *
 * Returns the plaintext so the caller can show it to the operator exactly
 * once; the store only retains its SHA-256 hash.
 */
export async function createKey(
  kv: Deno.Kv,
  label: string,
  opts: { env?: KeyEnvironment } = {},
): Promise<CreatedKey> {
  const env = opts.env ?? "live";
  const plaintext = newPlaintext(env);
  const hash = await sha256Hex(plaintext);
  const record: ApiKeyRecord = {
    id: newKeyId(),
    label,
    env,
    created_at: new Date().toISOString(),
    last_used_at: null,
    revoked_at: null,
  };

  const result = await kv.atomic()
    .check({ key: ["keys", hash], versionstamp: null })
    .check({ key: ["keys_index", record.id], versionstamp: null })
    .set(["keys", hash], record)
    .set(["keys_index", record.id], hash)
    .commit();

  if (!result.ok) {
    // Hash collision (astronomically unlikely) or id collision (retriable).
    // Treat as a hard failure — caller can retry.
    throw new Error("Failed to create key (collision or concurrent write)");
  }

  return { record, plaintext };
}

/** Return all keys, sorted newest-first. */
export async function listKeys(kv: Deno.Kv): Promise<ApiKeyRecord[]> {
  const out: ApiKeyRecord[] = [];
  for await (const entry of kv.list<ApiKeyRecord>({ prefix: ["keys"] })) {
    out.push(entry.value);
  }
  out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return out;
}

/**
 * Mark a key as revoked. Idempotent: calling on an already-revoked key
 * returns the existing record unchanged.
 *
 * Returns `null` if no key with that id exists.
 */
export async function revokeKey(
  kv: Deno.Kv,
  id: string,
): Promise<ApiKeyRecord | null> {
  const indexEntry = await kv.get<string>(["keys_index", id]);
  if (indexEntry.value === null) return null;
  const hash = indexEntry.value;

  const recordEntry = await kv.get<ApiKeyRecord>(["keys", hash]);
  if (recordEntry.value === null) return null;
  if (recordEntry.value.revoked_at !== null) return recordEntry.value;

  const updated: ApiKeyRecord = {
    ...recordEntry.value,
    revoked_at: new Date().toISOString(),
  };
  const result = await kv.atomic()
    .check(recordEntry)
    .set(["keys", hash], updated)
    .commit();
  if (!result.ok) {
    // Retry once — someone else wrote concurrently.
    return revokeKey(kv, id);
  }
  return updated;
}

/**
 * Look up a key by its plaintext token.
 * Returns the record if found and not revoked, else `null`.
 *
 * Shape validation happens first to avoid a KV read on obviously-malformed
 * input from anonymous clients.
 */
export async function lookupKeyByPlaintext(
  kv: Deno.Kv,
  plaintext: string,
): Promise<ApiKeyRecord | null> {
  if (!isWellFormedKey(plaintext)) return null;
  const hash = await sha256Hex(plaintext);
  const entry = await kv.get<ApiKeyRecord>(["keys", hash]);
  if (entry.value === null) return null;
  if (entry.value.revoked_at !== null) return null;
  return entry.value;
}

/**
 * Fire-and-forget update of `last_used_at`. Never throws — a failed touch
 * must not block the validated request.
 *
 * Uses a best-effort read-modify-write; concurrent touches are fine to lose.
 */
export async function touchKey(kv: Deno.Kv, id: string): Promise<void> {
  try {
    const indexEntry = await kv.get<string>(["keys_index", id]);
    if (indexEntry.value === null) return;
    const hash = indexEntry.value;
    const recordEntry = await kv.get<ApiKeyRecord>(["keys", hash]);
    if (recordEntry.value === null) return;
    const updated: ApiKeyRecord = {
      ...recordEntry.value,
      last_used_at: new Date().toISOString(),
    };
    await kv.atomic().check(recordEntry).set(["keys", hash], updated).commit();
  } catch {
    // Swallow — this is best-effort telemetry only.
  }
}
