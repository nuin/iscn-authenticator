/**
 * API key CRUD against Deno KV.
 *
 * Storage schema:
 *   ["keys", <sha256-hex>]        → ApiKeyRecord      primary store (lookup by plaintext)
 *   ["keys_index", <id>]          → <sha256-hex>      reverse index (lookup by id)
 *   ["key_customer", <id>]        → <customer_id>     denorm for quota hot path
 *
 * Plaintext is never persisted. `createKey()` returns it once; callers must
 * show it to the operator at that moment or it is unrecoverable.
 *
 * Key format:  iscn_live_<32 hex>  or  iscn_test_<32 hex>
 * The literal `iscn_live_` / `iscn_test_` prefix is deliberate — GitHub and
 * GitLab secret scanners detect this shape and flag leaked keys.
 *
 * `customer_id` is nullable: keys created before M2 have `customer_id = null`
 * and bypass quota enforcement (grandfathered "internal" keys). New
 * customer-owned keys populate both the record field and the denormalised
 * `key_customer:<id>` index.
 */

export type KeyEnvironment = "live" | "test";

export interface ApiKeyRecord {
  id: string;
  label: string;
  env: KeyEnvironment;
  created_at: string; // ISO 8601
  last_used_at: string | null;
  revoked_at: string | null;
  /** Null = grandfathered / internal. Non-null = owned by a customer. */
  customer_id: string | null;
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
  opts: { env?: KeyEnvironment; customerId?: string | null } = {},
): Promise<CreatedKey> {
  const env = opts.env ?? "live";
  const customerId = opts.customerId ?? null;
  const plaintext = newPlaintext(env);
  const hash = await sha256Hex(plaintext);
  const record: ApiKeyRecord = {
    id: newKeyId(),
    label,
    env,
    created_at: new Date().toISOString(),
    last_used_at: null,
    revoked_at: null,
    customer_id: customerId,
  };

  let tx = kv.atomic()
    .check({ key: ["keys", hash], versionstamp: null })
    .check({ key: ["keys_index", record.id], versionstamp: null })
    .set(["keys", hash], record)
    .set(["keys_index", record.id], hash);
  // Populate the denormalised index only for customer-owned keys. The
  // quota middleware reads this key directly; grandfathered keys skip the
  // lookup entirely when the denorm entry is absent.
  if (customerId !== null) {
    tx = tx.set(["key_customer", record.id], customerId);
  }
  const result = await tx.commit();

  if (!result.ok) {
    // Hash collision (astronomically unlikely) or id collision (retriable).
    // Treat as a hard failure — caller can retry.
    throw new Error("Failed to create key (collision or concurrent write)");
  }

  return { record, plaintext };
}

/**
 * Resolve a key's owning customer via the denormalised index.
 * Returns `null` for grandfathered/internal keys (no customer).
 */
export async function lookupCustomerForKey(
  kv: Deno.Kv,
  keyId: string,
): Promise<string | null> {
  const entry = await kv.get<string>(["key_customer", keyId]);
  return entry.value;
}

/**
 * Coerce a KV-read record to current schema. Records written before M2
 * lack `customer_id` — treat those as grandfathered (null).
 */
function normaliseRecord(raw: ApiKeyRecord): ApiKeyRecord {
  if (raw.customer_id === undefined) {
    return { ...raw, customer_id: null };
  }
  return raw;
}

/** Return all keys, sorted newest-first. */
export async function listKeys(kv: Deno.Kv): Promise<ApiKeyRecord[]> {
  const out: ApiKeyRecord[] = [];
  for await (const entry of kv.list<ApiKeyRecord>({ prefix: ["keys"] })) {
    out.push(normaliseRecord(entry.value));
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
  return normaliseRecord(entry.value);
}

/**
 * Atomically rotate a key: create a sibling (same label/env/customer)
 * then revoke the old record in a single commit. The old key is rejected
 * from the very next request — there is no overlap window, so callers
 * must swap their stored credential before making their next call.
 *
 * Returns `null` if `oldKeyId` does not exist or is already revoked.
 * Retries a small number of times on CAS contention (concurrent rotations
 * or a race against `touchKey`/`revokeKey`).
 */
export async function rotateKey(
  kv: Deno.Kv,
  oldKeyId: string,
): Promise<{ old: ApiKeyRecord; new: CreatedKey } | null> {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const indexEntry = await kv.get<string>(["keys_index", oldKeyId]);
    if (indexEntry.value === null) return null;
    const oldHash = indexEntry.value;

    const oldEntry = await kv.get<ApiKeyRecord>(["keys", oldHash]);
    if (oldEntry.value === null) return null;
    if (oldEntry.value.revoked_at !== null) return null;

    const oldRecord = normaliseRecord(oldEntry.value);
    const now = new Date().toISOString();

    const newPlain = newPlaintext(oldRecord.env);
    const newHash = await sha256Hex(newPlain);
    const newRecord: ApiKeyRecord = {
      id: newKeyId(),
      label: oldRecord.label,
      env: oldRecord.env,
      created_at: now,
      last_used_at: null,
      revoked_at: null,
      customer_id: oldRecord.customer_id,
    };
    const revokedOld: ApiKeyRecord = { ...oldRecord, revoked_at: now };

    let tx = kv.atomic()
      .check(oldEntry)
      .check({ key: ["keys", newHash], versionstamp: null })
      .check({ key: ["keys_index", newRecord.id], versionstamp: null })
      .set(["keys", oldHash], revokedOld)
      .set(["keys", newHash], newRecord)
      .set(["keys_index", newRecord.id], newHash);
    if (newRecord.customer_id !== null) {
      tx = tx.set(["key_customer", newRecord.id], newRecord.customer_id);
    }
    const result = await tx.commit();
    if (result.ok) {
      return { old: revokedOld, new: { record: newRecord, plaintext: newPlain } };
    }
    // CAS miss — retry the whole read+hash+commit with fresh versionstamps.
  }
  throw new Error(`rotateKey: CAS contention exceeded ${MAX_ATTEMPTS} attempts for ${oldKeyId}`);
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
