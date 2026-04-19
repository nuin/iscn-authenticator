#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-net --allow-env
/**
 * ISCN Karyotype Validator Web Server — local dev entry point.
 *
 * Wraps the shared `buildHandler` from `lib/middleware.ts` and serves the
 * filesystem-backed `static/` directory for the landing page. Prod runs
 * via `main.ts` (Deno Deploy) which embeds the same HTML inline; both
 * entry points share the same auth / rate-limit / security-headers pipeline.
 *
 * Usage:
 *   deno task serve
 *   deno task dev  (with --watch)
 */

import { loadConfig } from "./lib/config.ts";
import { buildHandler } from "./lib/middleware.ts";

const PORT = parseInt(Deno.env.get("PORT") ?? "8000");

const config = loadConfig();
const kv = await Deno.openKv(config.kvPath ?? undefined);

const staticDir = new URL("./static", import.meta.url).pathname;

const handler = buildHandler({ kv, config, staticDir });

console.log(`
  ISCN Karyotype Validator Server
  ================================

  Server running at http://localhost:${PORT}

  Endpoints:
    GET  /              Web UI
    GET  /health        Liveness probe
    GET  /validate?karyotype=...   (requires Bearer token)
    POST /validate                 (requires Bearer token, JSON body)

  Press Ctrl+C to stop
`);

Deno.serve({ port: PORT }, handler);
