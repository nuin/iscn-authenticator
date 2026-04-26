/**
 * Static and semi-dynamic marketing/compliance pages.
 */

const CONTENT_TYPE_HTML = "text/html; charset=utf-8";

export async function handlePricingPage(): Promise<Response> {
  const html = renderSimplePage(
    "Pricing",
    `
    <h2 style="text-align: center; margin-bottom: 2rem;">Simple, transparent pricing</h2>
    <div class="pricing-grid">
      <div class="pricing-card">
        <h3>Free</h3>
        <div class="price">$0<span>/mo</span></div>
        <ul>
          <li>1,000 API requests / mo</li>
          <li>Local-first validation</li>
          <li>Basic interpretations</li>
          <li>Community support</li>
        </ul>
        <a href="/signup" class="button button-outline">Get Started</a>
      </div>
      <div class="pricing-card featured">
        <div class="badge">Recommended</div>
        <h3>Pro</h3>
        <div class="price">$29<span>/mo</span></div>
        <ul>
          <li>100,000 API requests / mo</li>
          <li><strong>Batch validation (500 rows)</strong></li>
          <li><strong>Curated interpretation library</strong></li>
          <li>CSV/JSON exports</li>
          <li>Priority email support</li>
        </ul>
        <a href="/signup" class="button">Go Pro</a>
      </div>
    </div>
    <style>
      .pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem; }
      .pricing-card { padding: 2rem; border: 1px solid var(--color-border); border-radius: var(--radius); display: flex; flex-direction: column; position: relative; }
      .pricing-card.featured { border-color: var(--color-primary); box-shadow: 0 4px 12px rgba(13, 110, 253, 0.15); }
      .pricing-card .badge { position: absolute; top: -12px; right: 2rem; background: var(--color-primary); color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: bold; }
      .pricing-card h3 { margin-top: 0; font-size: 1.5rem; }
      .price { font-size: 2.5rem; font-weight: bold; margin: 1rem 0; }
      .price span { font-size: 1rem; color: var(--color-text-muted); font-weight: normal; }
      .pricing-card ul { list-style: none; padding: 0; margin: 1.5rem 0; flex: 1; }
      .pricing-card li { margin-bottom: 0.75rem; padding-left: 1.5rem; position: relative; }
      .pricing-card li::before { content: "✓"; position: absolute; left: 0; color: var(--color-primary); font-weight: bold; }
      .button { display: block; text-align: center; background: var(--color-primary); color: white; padding: 0.75rem; border-radius: 4px; text-decoration: none; font-weight: 500; }
      .button-outline { background: transparent; border: 2px solid var(--color-primary); color: var(--color-primary); }
      @media (max-width: 600px) { .pricing-grid { grid-template-columns: 1fr; } }
    </style>
  `,
  );
  return new Response(html, { headers: { "Content-Type": CONTENT_TYPE_HTML } });
}

/**
 * `/docs` (and the `/api` alias) serves a Scalar API-reference UI that
 * fetches `/openapi.json` from this same origin. The page is intentionally
 * minimal: Scalar bootstraps itself off the `<script id="api-reference">`
 * tag and the pinned jsDelivr bundle.
 *
 * CSP for this route is widened to allow `cdn.jsdelivr.net` for script,
 * style, font and img sources -- see `scalarCspHeader()` in
 * `lib/security_headers.ts`. `connect-src` stays `'self'` because the only
 * runtime fetch the page issues is `GET /openapi.json`.
 */
export function handleDocsPage(): Promise<Response> {
  return Promise.resolve(
    new Response(SCALAR_HTML, { headers: { "Content-Type": CONTENT_TYPE_HTML } }),
  );
}

const SCALAR_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>ISCN API Reference</title>
    <meta name="viewport" content="width=device-width,initial-scale=1">
  </head>
  <body>
    <script id="api-reference" data-url="/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1"></script>
  </body>
</html>
`;

export function handleAboutPage(): Promise<Response> {
  const html = renderSimplePage(
    "About ISCN 2024",
    `
    <h2>Authoritative Validation</h2>
    <p>The ISCN Authenticator is built against the <strong>International System for Human Cytogenomic Nomenclature (2024)</strong> specification.</p>
    <p>Our engine implements the formal grammar and rules defined in the latest consensus document, ensuring that your karyotypes adhere to international reporting standards.</p>
    
    <h3>How it works</h3>
    <ol>
      <li><strong>Parser:</strong> A recursive-descent parser converts ISCN strings into a structured Abstract Syntax Tree (AST).</li>
      <li><strong>Rule Engine:</strong> Over 50 validation rules check for numerical consistency, sex chromosome coherence, and structural abnormality syntax.</li>
      <li><strong>Explain Module:</strong> A curated clinical library provides spec-cited interpretations for common abnormalities.</li>
    </ol>
    
    <p>This tool is intended for research and educational use. Always consult with a certified clinical cytogeneticist for diagnostic reporting.</p>
  `,
  );
  return (Promise.resolve(new Response(html, { headers: { "Content-Type": CONTENT_TYPE_HTML } })));
}

/** Utility to render a consistent page shell. */
function renderSimplePage(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} | ISCN Authenticator</title>
  <style>
    :root {
      --color-bg: #f8f9fa;
      --color-surface: #ffffff;
      --color-text: #212529;
      --color-text-muted: #6c757d;
      --color-primary: #0d6efd;
      --color-border: #dee2e6;
      --font-mono: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
      --radius: 8px;
    }
    body { font-family: system-ui, sans-serif; background: var(--color-bg); color: var(--color-text); margin: 0; padding: 0; }
    .nav-bar { background: var(--color-surface); border-bottom: 1px solid var(--color-border); padding: 1rem; }
    .nav-content { max-width: 960px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
    .nav-links a { margin-left: 1.5rem; text-decoration: none; color: var(--color-text); font-size: 0.875rem; }
    .container { max-width: 960px; margin: 2rem auto; background: var(--color-surface); padding: 3rem; border-radius: var(--radius); box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    h1 { margin-top: 0; font-size: 1.75rem; }
    main { line-height: 1.6; }
    footer { max-width: 960px; margin: 2rem auto; text-align: center; color: var(--color-text-muted); font-size: 0.75rem; padding-bottom: 3rem; }
    a { color: var(--color-primary); }
  </style>
</head>
<body>
  <nav class="nav-bar">
    <div class="nav-content">
      <a href="/" style="font-weight: bold; text-decoration: none; color: var(--color-text);">ISCN Authenticator</a>
      <div class="nav-links">
        <a href="/explain">Library</a>
        <a href="/pricing">Pricing</a>
        <a href="/docs">API</a>
        <a href="/dashboard">Dashboard</a>
      </div>
    </div>
  </nav>
  <div class="container">
    <main>${content}</main>
  </div>
  <footer>
    &copy; 2026 ISCN Authenticator. Built for the clinical genetics community.
  </footer>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
