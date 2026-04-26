/**
 * `/docs` (and the `/api` alias) renders a Scalar API-reference page that
 * fetches `/openapi.json` from the same origin.
 *
 * What we lock down here:
 *   1. GET `/docs` (and `/api`) returns 200 text/html.
 *   2. The page bootstraps Scalar (`<script id="api-reference">` + the
 *      pinned jsDelivr bundle), and the `data-url` points at the spec.
 *   3. The Content-Security-Policy is the docs-specific one — it allows
 *      `cdn.jsdelivr.net` for scripts/styles/fonts/images but keeps
 *      `connect-src 'self'` so the page can only fetch /openapi.json from
 *      this origin (no third-party data exfil).
 *   4. The page does NOT inherit the dashboard CSP (no `unpkg.com`).
 */

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@^1.0.0";
import { buildHandler } from "../lib/middleware.ts";
import { defaultConfig } from "../lib/config.ts";

async function openMemoryKv(): Promise<Deno.Kv> {
  return await Deno.openKv(":memory:");
}

function makeHandler(kv: Deno.Kv) {
  return buildHandler({
    kv,
    config: defaultConfig(),
    staticHtml: "<html></html>",
    logSink: () => {},
  });
}

for (const path of ["/docs", "/api"]) {
  Deno.test(`GET ${path} renders the Scalar API reference`, async () => {
    const kv = await openMemoryKv();
    try {
      const handler = makeHandler(kv);
      const res = await handler(new Request(`http://x${path}`));
      assertEquals(res.status, 200);
      assert(
        res.headers.get("content-type")?.includes("text/html"),
        `${path} must serve HTML`,
      );

      const body = await res.text();
      assertStringIncludes(body, `id="api-reference"`);
      assertStringIncludes(body, `data-url="/openapi.json"`);
      assertStringIncludes(
        body,
        "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1",
      );
    } finally {
      kv.close();
    }
  });

  Deno.test(`GET ${path} sets the Scalar-specific CSP, not the dashboard one`, async () => {
    const kv = await openMemoryKv();
    try {
      const handler = makeHandler(kv);
      const res = await handler(new Request(`http://x${path}`));
      await res.body?.cancel();

      const csp = res.headers.get("content-security-policy") ?? "";
      assert(csp.length > 0, "expected a Content-Security-Policy header");
      assertStringIncludes(csp, "https://cdn.jsdelivr.net");
      // connect-src stays narrow -- only same-origin /openapi.json.
      assertStringIncludes(csp, "connect-src 'self'");
      // Make sure we didn't leak the dashboard CSP (which whitelists unpkg).
      assert(
        !csp.includes("unpkg.com"),
        "docs CSP must not allow unpkg.com (that is the dashboard policy)",
      );
    } finally {
      kv.close();
    }
  });
}
