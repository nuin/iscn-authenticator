/**
 * OpenAPI spec helpers.
 *
 * The canonical source for the API contract is `docs/openapi.yaml`. This
 * module parses that YAML once at first request and serves it as JSON via
 * `GET /openapi.json`. The same string is embedded in `main.ts` for Deno
 * Deploy parity (no filesystem reads on the edge); `server.ts` reads it
 * from disk for local development.
 *
 * Drift between the YAML and the live route table is caught by
 * `tests/openapi_test.ts`.
 */

import { parse as parseYaml } from "jsr:@std/yaml@^1.0.0";

/**
 * Parsed OpenAPI document. We intentionally keep the type loose (`unknown`)
 * because the spec is hand-maintained and we do not want a TypeScript type
 * to silently mask drift.
 */
export type OpenApiDocument = Record<string, unknown>;

/**
 * Parse the YAML once and reuse the JSON. Wrapped in a closure so callers
 * can share a single cache across requests without exposing the cache
 * variable.
 */
export function createOpenApiHandler(yaml: string): () => Response {
  let cachedJson: string | null = null;

  return function handleOpenApiSpec(): Response {
    if (cachedJson === null) {
      const doc = parseYaml(yaml) as OpenApiDocument;
      cachedJson = JSON.stringify(doc);
    }
    return new Response(cachedJson, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // The spec is immutable per deploy; allow CDNs/clients to cache.
        "Cache-Control": "public, max-age=300",
      },
    });
  };
}

/** Parse YAML to a plain object (exposed for tests / drift detection). */
export function parseOpenApiYaml(yaml: string): OpenApiDocument {
  return parseYaml(yaml) as OpenApiDocument;
}
