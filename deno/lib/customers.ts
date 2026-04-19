/**
 * Customer accounts and tier management.
 *
 * Storage schema:
 *   ["customers", <customer_id>]                    → CustomerRecord
 *   ["customers_by_email", <email_lowercase>]       → <customer_id>   (unique-by-email index)
 *
 * A customer owns zero or more API keys (many-to-one). Keys created before
 * M2 have `customer_id = null` and bypass quota enforcement — see
 * lib/keys.ts for the denormalised `key_customer:<id>` index used at the
 * auth hot path.
 *
 * Emails are stored canonicalised (lowercase, trimmed) so `LookupByEmail`
 * is case-insensitive. The original casing is not retained — this matches
 * RFC 5321 guidance that the local part is case-insensitive in practice
 * even though the spec allows servers to distinguish.
 */

export type CustomerTier = "free" | "pro";
export type CustomerStatus = "active" | "past_due" | "cancelled";

export interface CustomerRecord {
  id: string;
  email: string; // canonical (lowercase)
  created_at: string; // ISO 8601
  tier: CustomerTier;
  stripe_customer_id: string | null;
  status: CustomerStatus;
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

/** Generate an opaque customer identifier (safe to log). */
export function newCustomerId(): string {
  // 8 bytes → 16 hex. Wider than key ids — customers are longer-lived
  // and we expect far fewer collisions of the form `c_<prefix>` in logs.
  return `c_${randomHex(8)}`;
}

/** Normalise an email for storage + lookup (lowercase + trim). */
export function canonicaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Minimal shape check. Not RFC 5322 — we rely on Stripe for hard validation. */
export function isPlausibleEmail(raw: string): boolean {
  if (typeof raw !== "string") return false;
  const e = canonicaliseEmail(raw);
  // Single `@`, at least one char on either side, at least one dot in the
  // domain, no whitespace. Deliberately permissive — the goal is to reject
  // obvious garbage (`""`, `"foo"`, `"foo@bar"`) before we commit storage.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/**
 * Create a new customer atomically. Fails if the email is already taken.
 *
 * Returns `null` if the email conflicts with an existing customer. Throws
 * on invalid email (caller should pre-validate with `isPlausibleEmail`).
 */
export async function createCustomer(
  kv: Deno.Kv,
  rawEmail: string,
  opts: { tier?: CustomerTier } = {},
): Promise<CustomerRecord | null> {
  if (!isPlausibleEmail(rawEmail)) {
    throw new Error(`Invalid email: ${JSON.stringify(rawEmail)}`);
  }
  const email = canonicaliseEmail(rawEmail);
  const record: CustomerRecord = {
    id: newCustomerId(),
    email,
    created_at: new Date().toISOString(),
    tier: opts.tier ?? "free",
    stripe_customer_id: null,
    status: "active",
  };

  const result = await kv.atomic()
    .check({ key: ["customers_by_email", email], versionstamp: null })
    .check({ key: ["customers", record.id], versionstamp: null })
    .set(["customers", record.id], record)
    .set(["customers_by_email", email], record.id)
    .commit();

  if (!result.ok) {
    // Either email is taken (common) or id collision (astronomically rare).
    // Distinguish for the caller:
    const existing = await kv.get<string>(["customers_by_email", email]);
    if (existing.value !== null) return null;
    // Otherwise we hit an id collision — let the caller retry.
    throw new Error("Failed to create customer (id collision — retry)");
  }
  return record;
}

/** Look up a customer by opaque id. Returns `null` if not found. */
export async function lookupCustomerById(
  kv: Deno.Kv,
  id: string,
): Promise<CustomerRecord | null> {
  const entry = await kv.get<CustomerRecord>(["customers", id]);
  return entry.value;
}

/** Look up a customer by email (case-insensitive). Returns `null` if not found. */
export async function lookupCustomerByEmail(
  kv: Deno.Kv,
  rawEmail: string,
): Promise<CustomerRecord | null> {
  if (!isPlausibleEmail(rawEmail)) return null;
  const email = canonicaliseEmail(rawEmail);
  const indexEntry = await kv.get<string>(["customers_by_email", email]);
  if (indexEntry.value === null) return null;
  return await lookupCustomerById(kv, indexEntry.value);
}

/**
 * Update a customer's tier. Used by the Stripe webhook handler and the
 * admin CLI. Returns the updated record, or `null` if the customer
 * doesn't exist.
 *
 * Retries once on optimistic-concurrency failure.
 */
export async function updateCustomerTier(
  kv: Deno.Kv,
  id: string,
  tier: CustomerTier,
): Promise<CustomerRecord | null> {
  const entry = await kv.get<CustomerRecord>(["customers", id]);
  if (entry.value === null) return null;
  if (entry.value.tier === tier) return entry.value;
  const updated: CustomerRecord = { ...entry.value, tier };
  const result = await kv.atomic()
    .check(entry)
    .set(["customers", id], updated)
    .commit();
  if (!result.ok) return updateCustomerTier(kv, id, tier);
  return updated;
}

/**
 * Update a customer's status (active / past_due / cancelled). Called by
 * Stripe webhook handlers; also used by admin CLI for manual override.
 */
export async function updateCustomerStatus(
  kv: Deno.Kv,
  id: string,
  status: CustomerStatus,
): Promise<CustomerRecord | null> {
  const entry = await kv.get<CustomerRecord>(["customers", id]);
  if (entry.value === null) return null;
  if (entry.value.status === status) return entry.value;
  const updated: CustomerRecord = { ...entry.value, status };
  const result = await kv.atomic()
    .check(entry)
    .set(["customers", id], updated)
    .commit();
  if (!result.ok) return updateCustomerStatus(kv, id, status);
  return updated;
}

/**
 * Attach a Stripe customer id. Called the first time a customer hits
 * Checkout; subsequent checkouts reuse the same Stripe customer record.
 */
export async function attachStripeCustomer(
  kv: Deno.Kv,
  id: string,
  stripeCustomerId: string,
): Promise<CustomerRecord | null> {
  const entry = await kv.get<CustomerRecord>(["customers", id]);
  if (entry.value === null) return null;
  const updated: CustomerRecord = {
    ...entry.value,
    stripe_customer_id: stripeCustomerId,
  };
  const result = await kv.atomic()
    .check(entry)
    .set(["customers", id], updated)
    .commit();
  if (!result.ok) return attachStripeCustomer(kv, id, stripeCustomerId);
  return updated;
}

/** Return all customers, sorted newest-first. */
export async function listCustomers(kv: Deno.Kv): Promise<CustomerRecord[]> {
  const out: CustomerRecord[] = [];
  for await (const entry of kv.list<CustomerRecord>({ prefix: ["customers"] })) {
    out.push(entry.value);
  }
  out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return out;
}
