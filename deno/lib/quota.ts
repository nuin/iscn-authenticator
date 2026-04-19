/**
 * Monthly request-quota library.
 *
 * Usage counter lives at ["usage", customer_id, yyyymm] as a plain number.
 * TTL on the KV entry is ~40 days, which is long enough to service end-of-
 * period reporting for the previous month before auto-expiring.
 *
 * Enforcement model:
 *   - `incrementUsage()` is called on the validated-request hot path with
 *     the customer's tier-derived limit. It performs a read / compare /
 *     CAS-write so the counter never exceeds the limit, and throws
 *     `QuotaExceededError` the moment a request would push it over.
 *   - Grandfathered keys (customer_id = null) never reach this code; the
 *     middleware skips the whole block for them.
 *   - `peekUsage()` is a read-only sibling used by the `/usage` endpoint
 *     (M2/10) and never mutates state.
 *
 * Reset semantics: the reset_at timestamp in each snapshot is the Unix-
 * epoch seconds at the start of the next UTC month. Counter keys are
 * themselves bucketed by YYYYMM so month rollover starts fresh at 0
 * automatically — no cron job required.
 */

import type { Config } from "./config.ts";
import type { CustomerTier } from "./customers.ts";
import { QuotaExceededError } from "./errors.ts";

/** TTL applied to each usage counter entry: 40 days (ms). */
const USAGE_TTL_MS = 40 * 24 * 60 * 60 * 1000;

/** Number of CAS retries before we give up and surface a 500. */
const MAX_CAS_RETRIES = 5;

export interface QuotaSnapshot {
  /** Customer tier used to derive the limit. */
  tier: CustomerTier;
  /** Total requests counted this month (after the current increment, if any). */
  used: number;
  /** Max requests permitted this month for this tier. */
  limit: number;
  /** `max(0, limit - used)`. */
  remaining: number;
  /** Unix-epoch seconds at the start of the next UTC month. */
  reset_at: number;
}

/** `YYYYMM` bucket in UTC for the given instant. */
export function currentMonthYYYYMM(now: Date = new Date()): string {
  const y = now.getUTCFullYear().toString().padStart(4, "0");
  const m = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${y}${m}`;
}

/** Unix-epoch seconds at the start of the next UTC month. */
export function nextMonthResetEpochSeconds(now: Date = new Date()): number {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  // `Date.UTC(y, m+1, 1)` handles December → January rollover correctly.
  return Math.floor(Date.UTC(y, m + 1, 1, 0, 0, 0, 0) / 1000);
}

/** Resolve the monthly request limit for a customer tier. */
export function quotaFor(tier: CustomerTier, config: Config): number {
  return tier === "pro" ? config.monthlyQuotaPro : config.monthlyQuotaFree;
}

/** KV key for a customer's monthly counter. Exported for tests. */
export function usageKey(customerId: string, month: string): Deno.KvKey {
  return ["usage", customerId, month];
}

/**
 * Read the current-month counter without mutating it.
 * Returned snapshot reflects the last committed value.
 */
export async function peekUsage(
  kv: Deno.Kv,
  customerId: string,
  opts: { tier: CustomerTier; limit: number; now?: Date },
): Promise<QuotaSnapshot> {
  const now = opts.now ?? new Date();
  const month = currentMonthYYYYMM(now);
  const entry = await kv.get<number>(usageKey(customerId, month));
  const used = typeof entry.value === "number" ? entry.value : 0;
  return {
    tier: opts.tier,
    used,
    limit: opts.limit,
    remaining: Math.max(0, opts.limit - used),
    reset_at: nextMonthResetEpochSeconds(now),
  };
}

/**
 * Atomically bump the current-month counter for `customerId`.
 *
 * Returns a snapshot for the *post-increment* state on success.
 * Throws `QuotaExceededError` when the pre-increment value already meets
 * or exceeds the limit; the counter is not modified in that case.
 *
 * Contention is handled with a bounded CAS loop. After MAX_CAS_RETRIES
 * failed commits the caller receives an unrelated 500 — expected in
 * practice never to happen, as we only contend against other requests
 * for the same customer.
 */
export async function incrementUsage(
  kv: Deno.Kv,
  customerId: string,
  opts: { tier: CustomerTier; limit: number; now?: Date },
): Promise<QuotaSnapshot> {
  const now = opts.now ?? new Date();
  const month = currentMonthYYYYMM(now);
  const key = usageKey(customerId, month);
  const resetAt = nextMonthResetEpochSeconds(now);

  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
    const entry = await kv.get<number>(key);
    const current = typeof entry.value === "number" ? entry.value : 0;

    if (current >= opts.limit) {
      // Refuse — do not bump.
      throw new QuotaExceededError(opts.limit, resetAt);
    }

    const next = current + 1;
    const result = await kv.atomic()
      .check(entry)
      .set(key, next, { expireIn: USAGE_TTL_MS })
      .commit();

    if (result.ok) {
      return {
        tier: opts.tier,
        used: next,
        limit: opts.limit,
        remaining: Math.max(0, opts.limit - next),
        reset_at: resetAt,
      };
    }
    // Concurrent write lost the CAS race — retry.
  }

  throw new Error(
    `quota counter for ${customerId} could not commit after ${MAX_CAS_RETRIES} attempts`,
  );
}

/** Headers emitted on validated responses to advertise the current quota state. */
export function monthlyQuotaHeaders(
  snapshot: QuotaSnapshot,
): Record<string, string> {
  return {
    "X-Monthly-Quota-Limit": String(snapshot.limit),
    "X-Monthly-Quota-Remaining": String(snapshot.remaining),
    "X-Monthly-Quota-Reset": String(snapshot.reset_at),
  };
}
