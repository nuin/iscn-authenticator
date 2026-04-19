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
  };
}

/** Test helper — returns a config with every field at default. */
export function defaultConfig(): Config {
  return { ...DEFAULTS, allowedOrigins: [...DEFAULTS.allowedOrigins] };
}
