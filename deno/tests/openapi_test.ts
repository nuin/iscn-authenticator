/**
 * OpenAPI spec drift tests.
 *
 * Three guarantees we want to keep green:
 *
 *   1. The canonical YAML at `docs/openapi.yaml` parses cleanly.
 *   2. The string embedded in `deno/main.ts` (for Deno Deploy) matches the
 *      canonical YAML byte-for-byte. Run `embed-openapi.ts` to refresh.
 *   3. `GET /openapi.json` returns the parsed JSON of the same document.
 *
 * Route-vs-spec drift is checked structurally: every JSON-API path in the
 * spec must exist in the live route table, and every JSON-API path in the
 * route table must appear in the spec. HTML routes (`/`, `/dashboard/*`,
 * `/signup`, `/login`, `/logout`, `/pricing`, `/docs`, `/about`,
 * `/explain*`, `/static/*`, `/api`) are deliberately excluded -- the spec
 * documents the JSON surface only.
 */

import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import { parse as parseYaml } from "jsr:@std/yaml@^1.0.0";
import { buildHandler } from "../lib/middleware.ts";
import { defaultConfig } from "../lib/config.ts";

const REPO_ROOT = new URL("../../", import.meta.url);
const YAML_URL = new URL("docs/openapi.yaml", REPO_ROOT);
const MAIN_URL = new URL("deno/main.ts", REPO_ROOT);

async function openMemoryKv(): Promise<Deno.Kv> {
  return await Deno.openKv(":memory:");
}

async function readYaml(): Promise<string> {
  return await Deno.readTextFile(YAML_URL);
}

async function readEmbeddedYaml(): Promise<string> {
  const main = await Deno.readTextFile(MAIN_URL);
  const begin = main.indexOf("// BEGIN_EMBEDDED_OPENAPI_YAML");
  const end = main.indexOf("// END_EMBEDDED_OPENAPI_YAML");
  assert(begin >= 0 && end > begin, "embed markers missing in deno/main.ts");
  const block = main.slice(begin, end);
  // The embed script writes:
  //   const OPENAPI_YAML: string = "...";
  // Pull the JSON-encoded literal out and decode.
  const match = block.match(/const OPENAPI_YAML:\s*string\s*=\s*("[\s\S]*?");\s*$/m);
  assert(match, "OPENAPI_YAML literal not found between embed markers");
  return JSON.parse(match[1]) as string;
}

function specPaths(doc: Record<string, unknown>): Set<string> {
  const paths = doc.paths as Record<string, unknown> | undefined;
  if (!paths) return new Set();
  return new Set(Object.keys(paths));
}

/**
 * Live API paths the OpenAPI spec is expected to cover. Mirrors the JSON
 * route arms in `lib/middleware.ts`. HTML routes are intentionally absent.
 */
const LIVE_API_PATHS = new Set<string>([
  "/health",
  "/openapi.json",
  "/validate",
  "/usage",
  "/keys/rotate",
  "/billing/webhook",
]);

Deno.test("openapi: canonical YAML parses to an object with paths", async () => {
  const yaml = await readYaml();
  const doc = parseYaml(yaml) as Record<string, unknown>;
  assertEquals(doc.openapi, "3.1.0");
  const paths = doc.paths as Record<string, unknown>;
  assert(paths && typeof paths === "object", "spec must define `paths`");
  assert(Object.keys(paths).length > 0, "spec must have at least one path");
});

Deno.test("openapi: embedded YAML in main.ts matches canonical file byte-for-byte", async () => {
  const canonical = await readYaml();
  const embedded = await readEmbeddedYaml();
  assertEquals(
    embedded,
    canonical,
    "deno/main.ts is out of sync with docs/openapi.yaml. " +
      "Run: deno run --allow-read --allow-write deno/scripts/embed-openapi.ts",
  );
});

Deno.test("openapi: spec paths exactly match the live JSON-API route table", async () => {
  const yaml = await readYaml();
  const doc = parseYaml(yaml) as Record<string, unknown>;
  const inSpec = specPaths(doc);

  const missingFromSpec = [...LIVE_API_PATHS].filter((p) => !inSpec.has(p));
  const extraInSpec = [...inSpec].filter((p) => !LIVE_API_PATHS.has(p));

  assertEquals(
    missingFromSpec,
    [],
    `Live routes not documented in OpenAPI spec: ${missingFromSpec.join(", ")}`,
  );
  assertEquals(
    extraInSpec,
    [],
    `Spec paths with no matching live route: ${extraInSpec.join(", ")}`,
  );
});

Deno.test("GET /openapi.json returns parsed JSON of the canonical spec", async () => {
  const kv = await openMemoryKv();
  try {
    const yaml = await readYaml();
    const handler = buildHandler({
      kv,
      config: defaultConfig(),
      staticHtml: "<html></html>",
      openapiYaml: yaml,
      logSink: () => {},
    });
    const res = await handler(new Request("http://x/openapi.json"));
    assertEquals(res.status, 200);
    assert(
      res.headers.get("content-type")?.includes("application/json"),
      "/openapi.json must serve JSON",
    );
    const body = await res.json();
    assertEquals(body.openapi, "3.1.0");
    assert(body.paths["/health"], "spec served at runtime must include /health");
    assert(body.paths["/validate"], "spec served at runtime must include /validate");
    assert(body.components?.schemas?.ApiError, "ApiError schema must be present");
  } finally {
    kv.close();
  }
});

Deno.test("GET /openapi.json with no embedded spec falls through to 404", async () => {
  const kv = await openMemoryKv();
  try {
    const handler = buildHandler({
      kv,
      config: defaultConfig(),
      staticHtml: "<html></html>",
      // openapiYaml deliberately omitted
      logSink: () => {},
    });
    const res = await handler(new Request("http://x/openapi.json"));
    assertEquals(res.status, 404);
    await res.body?.cancel();
  } finally {
    kv.close();
  }
});

Deno.test("POST /openapi.json returns 405 (read-only endpoint)", async () => {
  const kv = await openMemoryKv();
  try {
    const yaml = await readYaml();
    const handler = buildHandler({
      kv,
      config: defaultConfig(),
      staticHtml: "<html></html>",
      openapiYaml: yaml,
      logSink: () => {},
    });
    const res = await handler(
      new Request("http://x/openapi.json", { method: "POST" }),
    );
    assertEquals(res.status, 405);
    assertEquals(res.headers.get("allow"), "GET");
    await res.body?.cancel();
  } finally {
    kv.close();
  }
});
