import { assertEquals, assertThrows } from "jsr:@std/assert@^1.0.0";
import { defaultConfig, loadConfig } from "../lib/config.ts";

/**
 * Save and restore environment variables around a test block, so tests do not
 * leak state into each other or into neighbouring tests.
 */
function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
  const keys = Object.keys(overrides);
  const prior: Record<string, string | undefined> = {};
  for (const k of keys) prior[k] = Deno.env.get(k);
  try {
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
    fn();
  } finally {
    for (const k of keys) {
      const v = prior[k];
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

const ENV_KEYS = [
  "ALLOWED_ORIGINS",
  "RATE_LIMIT_PER_MIN",
  "MAX_BODY_BYTES",
  "MAX_KARYOTYPE_LENGTH",
  "KV_PATH",
  "DEBUG_ERRORS",
];

function clearedEnv(): Record<string, undefined> {
  return Object.fromEntries(ENV_KEYS.map((k) => [k, undefined]));
}

Deno.test("loadConfig: defaults when no env vars set", () => {
  withEnv(clearedEnv(), () => {
    const cfg = loadConfig();
    assertEquals(cfg.allowedOrigins, ["*"]);
    assertEquals(cfg.rateLimitPerMin, 60);
    assertEquals(cfg.maxBodyBytes, 16 * 1024);
    assertEquals(cfg.maxKaryotypeLength, 2048);
    assertEquals(cfg.kvPath, null);
    assertEquals(cfg.debugErrors, false);
  });
});

Deno.test("loadConfig: parses positive integers", () => {
  withEnv({
    ...clearedEnv(),
    RATE_LIMIT_PER_MIN: "120",
    MAX_BODY_BYTES: "65536",
    MAX_KARYOTYPE_LENGTH: "4096",
  }, () => {
    const cfg = loadConfig();
    assertEquals(cfg.rateLimitPerMin, 120);
    assertEquals(cfg.maxBodyBytes, 65536);
    assertEquals(cfg.maxKaryotypeLength, 4096);
  });
});

Deno.test("loadConfig: rejects non-positive integers", () => {
  withEnv({ ...clearedEnv(), RATE_LIMIT_PER_MIN: "0" }, () => {
    assertThrows(() => loadConfig(), Error, "Invalid RATE_LIMIT_PER_MIN");
  });
  withEnv({ ...clearedEnv(), RATE_LIMIT_PER_MIN: "-5" }, () => {
    assertThrows(() => loadConfig(), Error, "Invalid RATE_LIMIT_PER_MIN");
  });
  withEnv({ ...clearedEnv(), RATE_LIMIT_PER_MIN: "abc" }, () => {
    assertThrows(() => loadConfig(), Error, "Invalid RATE_LIMIT_PER_MIN");
  });
});

Deno.test("loadConfig: parses comma-separated origins", () => {
  withEnv({
    ...clearedEnv(),
    ALLOWED_ORIGINS: "https://a.example, https://b.example ,https://c.example",
  }, () => {
    const cfg = loadConfig();
    assertEquals(cfg.allowedOrigins, [
      "https://a.example",
      "https://b.example",
      "https://c.example",
    ]);
  });
});

Deno.test("loadConfig: filters empty origin tokens", () => {
  withEnv({ ...clearedEnv(), ALLOWED_ORIGINS: "https://a.example,, ," }, () => {
    const cfg = loadConfig();
    assertEquals(cfg.allowedOrigins, ["https://a.example"]);
  });
});

Deno.test("loadConfig: DEBUG_ERRORS true/1/false", () => {
  withEnv({ ...clearedEnv(), DEBUG_ERRORS: "true" }, () => {
    assertEquals(loadConfig().debugErrors, true);
  });
  withEnv({ ...clearedEnv(), DEBUG_ERRORS: "1" }, () => {
    assertEquals(loadConfig().debugErrors, true);
  });
  withEnv({ ...clearedEnv(), DEBUG_ERRORS: "false" }, () => {
    assertEquals(loadConfig().debugErrors, false);
  });
  withEnv({ ...clearedEnv(), DEBUG_ERRORS: "0" }, () => {
    assertEquals(loadConfig().debugErrors, false);
  });
});

Deno.test("defaultConfig: returns an independent copy", () => {
  const a = defaultConfig();
  const b = defaultConfig();
  a.allowedOrigins.push("https://mutated.example");
  assertEquals(b.allowedOrigins, ["*"]); // b unaffected
});
