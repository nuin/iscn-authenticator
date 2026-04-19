/**
 * Security response headers applied to every response.
 *
 * Policy:
 *   - HSTS: force HTTPS for 1 year, include subdomains. Safe because the
 *     production host (Deno Deploy) is HTTPS-only; local dev ignores it.
 *   - X-Content-Type-Options: nosniff -- block MIME sniffing, mitigates
 *     some stored-XSS vectors if user-controlled content is ever reflected.
 *   - X-Frame-Options: DENY -- no framing. The UI doesn't need embedding
 *     and this blocks clickjacking cheaply.
 *   - Referrer-Policy: no-referrer -- don't leak validator URLs (which
 *     may include karyotype query strings) to third parties.
 *   - Content-Security-Policy: tight policy for the HTML UI, permissive
 *     enough for the inline <style>/<script> the embedded page uses.
 *     JSON responses get the CSP too but browsers ignore it for JSON.
 *
 * Kept as a plain record so it composes cleanly with per-response headers
 * (CORS, rate-limit, request-id) without a dedicated middleware class.
 */

/** Base security headers for every response (HTML or JSON). */
export function baseSecurityHeaders(): Record<string, string> {
  return {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  };
}

/**
 * Content-Security-Policy for the HTML landing page.
 * The inline <style> and <script> in main.ts require 'unsafe-inline'; the
 * page is otherwise self-contained and makes only same-origin fetches.
 */
export function htmlCspHeader(): string {
  return [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline'",
    "connect-src 'self'",
    "img-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/** Merge the given headers over a base set without clobbering existing values. */
export function mergeHeaders(
  base: HeadersInit | undefined,
  extra: Record<string, string>,
): Headers {
  const h = new Headers(base);
  for (const [k, v] of Object.entries(extra)) {
    // Do not override explicitly-set headers (e.g., Content-Type).
    if (!h.has(k)) h.set(k, v);
  }
  return h;
}

/**
 * Attach security headers to a response, returning a new Response. Existing
 * headers on the response are preserved; security headers are additive.
 */
export function withSecurityHeaders(res: Response, isHtml = false): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(baseSecurityHeaders())) {
    if (!headers.has(k)) headers.set(k, v);
  }
  if (isHtml && !headers.has("Content-Security-Policy")) {
    headers.set("Content-Security-Policy", htmlCspHeader());
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
