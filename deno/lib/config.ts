/**
 * Environment-variable configuration for the Deno app.
 *
 * All values are resolved once via `loadConfig()` and passed explicitly into
 * the middleware pipeline — no runtime `Deno.env.get` calls inside handlers.
 * This keeps tests hermetic (override by constructing a Config literal).
 */

export interface Config {
  /** Comma-separated origins allowed for CORS. Use `"*"` for any. */
  allowedOrigins: string[];
  /** Per-key refill rate for the token bucket, in requests per minute. */
  rateLimitPerMin: number;
  /** Per-key token-bucket capacity (peak burst). Defaults to `2 * rateLimitPerMin`. */
  rateLimitBurst: number;
  /** Max request body size in bytes (POST /validate). */
  maxBodyBytes: number;
  /** Max karyotype string length in characters. */
  maxKaryotypeLength: number;
  /** Path passed to `Deno.openKv()`. `null` uses the default (Deno Deploy KV or local default). */
  kvPath: string | null;
  /** When true, include stack traces in 500 responses (dev only). */
  debugErrors: boolean;
  /** Monthly request cap for Free-tier customers. */
  monthlyQuotaFree: number;
  /** Monthly request cap for Pro-tier customers. */
  monthlyQuotaPro: number;
  /** Axiom ingest token. Empty string disables Axiom forwarding. */
  axiomApiToken: string;
  /** Axiom dataset name. Empty string disables Axiom forwarding. */
  axiomDataset: string;
  /**
   * HMAC secret for signing session cookies. Required in production
   * (`DENO_ENV=production`); auto-generated with a stderr warning in dev so
   * local runs "just work". Rotating this value invalidates every active
   * session — intentional, since there is no in-flight secret rotation.
   */
  sessionSecret: string;
}

const DEFAULTS: Config = {
  allowedOrigins: ["*"],
  rateLimitPerMin: 60,
  rateLimitBurst: 120, // 2x refill — absorbs polite retry-with-jitter
  maxBodyBytes: 16 * 1024, // 16 KB — plenty for a karyotype payload
  maxKaryotypeLength: 2048, // 2 KB of text
  kvPath: null,
  debugErrors: false,
  monthlyQuotaFree: 10_000,
  monthlyQuotaPro: 1_000_000,
  axiomApiToken: "",
  axiomDataset: "",
  sessionSecret: "",
};

function parseIntEnv(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name}: ${raw} (expected positive integer)`);
  }
  return parsed;
}

function parseOriginsEnv(name: string, fallback: string[]): string[] {
  const raw = Deno.env.get(name);
  if (raw === undefined || raw === "") return fallback;
  return raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

function parseBoolEnv(name: string, fallback: boolean): boolean {
  const raw = Deno.env.get(name);
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

/** Load config from environment variables, falling back to sensible defaults. */
export function loadConfig(): Config {
  const rateLimitPerMin = parseIntEnv("RATE_LIMIT_PER_MIN", DEFAULTS.rateLimitPerMin);
  // Burst defaults to 2 × refill when RATE_LIMIT_BURST is not set explicitly.
  const rateLimitBurst = parseIntEnv("RATE_LIMIT_BURST", rateLimitPerMin * 2);
  return {
    allowedOrigins: parseOriginsEnv("ALLOWED_ORIGINS", DEFAULTS.allowedOrigins),
    rateLimitPerMin,
    rateLimitBurst,
    maxBodyBytes: parseIntEnv("MAX_BODY_BYTES", DEFAULTS.maxBodyBytes),
    maxKaryotypeLength: parseIntEnv("MAX_KARYOTYPE_LENGTH", DEFAULTS.maxKaryotypeLength),
    kvPath: Deno.env.get("KV_PATH") ?? DEFAULTS.kvPath,
    debugErrors: parseBoolEnv("DEBUG_ERRORS", DEFAULTS.debugErrors),
    monthlyQuotaFree: parseIntEnv("MONTHLY_QUOTA_FREE", DEFAULTS.monthlyQuotaFree),
    monthlyQuotaPro: parseIntEnv("MONTHLY_QUOTA_PRO", DEFAULTS.monthlyQuotaPro),
    axiomApiToken: Deno.env.get("AXIOM_API_TOKEN") ?? DEFAULTS.axiomApiToken,
    axiomDataset: Deno.env.get("AXIOM_DATASET") ?? DEFAULTS.axiomDataset,
    sessionSecret: resolveSessionSecret(),
  };
}

/**
 * Pull `SESSION_SECRET` from the environment. In production, it is mandatory:
 * rotating the secret invalidates every live session but there is no startup-
 * time fallback, so a missing value is a hard stop. In development we
 * auto-generate a 32-byte random secret and print a loud stderr warning so
 * operators notice when they've forgotten to configure it.
 */
function resolveSessionSecret(): string {
  const raw = Deno.env.get("SESSION_SECRET");
  if (raw && raw.length > 0) return raw;
  const env = (Deno.env.get("DENO_ENV") ?? "").toLowerCase();
  if (env === "production" || env === "prod") {
    throw new Error("SESSION_SECRET is required when DENO_ENV=production");
  }
  const generated = randomHex(32);
  console.warn(
    "[config] SESSION_SECRET not set — generated a dev-only value. " +
      "Sessions will reset on every restart. Set SESSION_SECRET before prod.",
  );
  return generated;
}

function randomHex(numBytes: number): string {
  const buf = new Uint8Array(numBytes);
  crypto.getRandomValues(buf);
  let out = "";
  for (const b of buf) out += b.toString(16).padStart(2, "0");
  return out;
}

/** Test helper — returns a config with every field at default. */
export function defaultConfig(): Config {
  return {
    ...DEFAULTS,
    allowedOrigins: [...DEFAULTS.allowedOrigins],
    // Tests that exercise session code need a stable non-empty secret. Tests
    // that don't care about sessions can ignore this field.
    sessionSecret: "test-session-secret",
  };
}
