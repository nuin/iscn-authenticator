#!/usr/bin/env -S deno run --allow-run --allow-read --allow-net --allow-env

/**
 * ISCN Karyotype Validator Web Server
 *
 * Usage:
 *   deno task serve
 *   deno task dev  (with hot reload)
 *
 * Then open http://localhost:8000
 */

import { validateKaryotype } from "./lib/validator.ts";

const PORT = parseInt(Deno.env.get("PORT") ?? "8000");

/** Get content type for a file extension */
function getContentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    html: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "application/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
    png: "image/png",
    svg: "image/svg+xml",
    ico: "image/x-icon",
  };
  return types[ext ?? ""] ?? "application/octet-stream";
}

/** Serve a static file */
async function serveStaticFile(path: string): Promise<Response> {
  try {
    const moduleUrl = new URL(import.meta.url);
    const modulePath = moduleUrl.pathname;
    const staticDir = modulePath.replace(/\/server\.ts$/, "/static");
    const filePath = `${staticDir}${path}`;

    const content = await Deno.readFile(filePath);
    return new Response(content, {
      headers: { "Content-Type": getContentType(path) },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

/** Handle validation API request */
async function handleValidate(req: Request): Promise<Response> {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    let karyotype: string;

    if (req.method === "POST") {
      const body = await req.json();
      karyotype = body.karyotype;
    } else {
      const url = new URL(req.url);
      karyotype = url.searchParams.get("karyotype") ?? "";
    }

    if (!karyotype) {
      return new Response(
        JSON.stringify({ valid: false, errors: ["No karyotype provided"], parsed: null }),
        { status: 400, headers }
      );
    }

    const result = await validateKaryotype(karyotype);
    return new Response(JSON.stringify(result), { headers });
  } catch (error) {
    return new Response(
      JSON.stringify({
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        parsed: null,
      }),
      { status: 500, headers }
    );
  }
}

/** Main request handler */
async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // API endpoint
  if (path === "/validate") {
    return handleValidate(req);
  }

  // Serve index.html for root
  if (path === "/" || path === "/index.html") {
    return serveStaticFile("/index.html");
  }

  // Serve static files
  if (path.startsWith("/static/") || path.endsWith(".css") || path.endsWith(".js")) {
    const filePath = path.startsWith("/static/") ? path.replace("/static", "") : path;
    return serveStaticFile(filePath);
  }

  return new Response("Not Found", { status: 404 });
}

// Start server
console.log(`
  ISCN Karyotype Validator Server
  ================================

  Server running at http://localhost:${PORT}

  Endpoints:
    GET  /              Web UI
    POST /validate      Validate karyotype (JSON body: {"karyotype": "..."})
    GET  /validate?karyotype=...  Validate via query string

  Press Ctrl+C to stop
`);

Deno.serve({ port: PORT }, handler);
