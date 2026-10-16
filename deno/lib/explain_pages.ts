/** Public curated-explanation pages. */
import { type CuratedEntry, getCuratedSignatures } from "../../packages/core/src/index.ts";
import { NotFoundError } from "./errors.ts";

const CONTENT_TYPE_HTML = "text/html; charset=utf-8";

export function handleExplainRoute(req: Request): Response {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/explain" || path === "/explain/") {
    return renderExplainIndex();
  }

  const signature = decodeURIComponent(path.substring("/explain/".length));
  const entry = getCuratedSignatures()[signature];

  if (!entry) {
    throw new NotFoundError();
  }

  return renderExplainEntry(signature, entry);
}

function renderExplainIndex(): Response {
  const signatures = Object.keys(getCuratedSignatures());
  const listItems = signatures
    .map(
      (sig) => `<li><a href="/explain/${encodeURIComponent(sig)}">${escapeHtml(sig)}</a></li>`,
    )
    .join("");

  const html = renderSimplePage(
    "Curated ISCN Explanations",
    `
    <h2>Common Karyotypes</h2>
    <p>A library of human-curated explanations for common ISCN 2024 karyotype strings.</p>
    <ul class="explain-list">
      ${listItems}
    </ul>
    <style>
      .explain-list { margin-top: 1rem; }
      .explain-list li { margin-bottom: 0.5rem; }
      .explain-list a { color: var(--color-primary); text-decoration: none; font-family: var(--font-mono); }
      .explain-list a:hover { text-decoration: underline; }
    </style>
  `,
  );

  return new Response(html, {
    headers: { "Content-Type": CONTENT_TYPE_HTML },
  });
}

function renderExplainEntry(signature: string, entry: CuratedEntry): Response {
  const refs = entry.refs || {};
  let refsHtml = "";
  if (refs.omim?.length || refs.hpo?.length || refs.clinvar?.length) {
    refsHtml = "<h3>References</h3><ul class='refs'>";
    if (refs.omim) {
      refs.omim.forEach((id: string) => {
        refsHtml +=
          `<li>OMIM: <a href="https://omim.org/entry/${id}" target="_blank">${id}</a></li>`;
      });
    }
    if (refs.hpo) {
      refs.hpo.forEach((id: string) => {
        refsHtml +=
          `<li>HPO: <a href="https://hpo.jax.org/app/browse/term/${id}" target="_blank">${id}</a></li>`;
      });
    }
    refsHtml += "</ul>";
  }

  const html = renderSimplePage(
    `${signature} - ISCN Explanation`,
    `
    <nav><a href="/explain">&larr; All Explanations</a></nav>
    <h2 style="font-family: var(--font-mono); margin-top: 1rem;">${escapeHtml(signature)}</h2>
    <div class="explain-card">
      <p class="summary"><strong>${escapeHtml(entry.summary)}</strong></p>
      <p class="detail">${escapeHtml(entry.detail)}</p>
      ${
      entry.citation
        ? `<p class="citation"><em>Source: ISCN 2024 § ${entry.citation.section}${
          entry.citation.page ? ", p. " + entry.citation.page : ""
        }</em></p>`
        : ""
    }
    </div>
    ${refsHtml}
    <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--color-border);">
      <a href="/?karyotype=${
      encodeURIComponent(signature)
    }" class="button">Validate this Karyotype</a>
    </div>
    <style>
      nav a { color: var(--color-text-muted); text-decoration: none; font-size: 0.875rem; }
      .explain-card { margin: 1.5rem 0; padding: 1.5rem; background: var(--color-bg); border-radius: var(--radius); }
      .summary { font-size: 1.125rem; margin-bottom: 1rem; }
      .detail { line-height: 1.6; margin-bottom: 1rem; }
      .citation { font-size: 0.875rem; color: var(--color-text-muted); }
      .refs { margin: 1rem 0; }
      .refs li { font-size: 0.875rem; margin-bottom: 0.25rem; }
      .button { display: inline-block; background: var(--color-primary); color: white; padding: 0.5rem 1rem; border-radius: 4px; text-decoration: none; }
    </style>
  `,
  );

  return new Response(html, {
    headers: { "Content-Type": CONTENT_TYPE_HTML },
  });
}

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
    body { font-family: system-ui, sans-serif; background: var(--color-bg); color: var(--color-text); margin: 0; padding: 2rem 1rem; }
    .container { max-width: 800px; margin: 0 auto; background: var(--color-surface); padding: 2rem; border-radius: var(--radius); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { margin-top: 0; font-size: 1.5rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.5rem; }
    a { color: var(--color-primary); }
  </style>
</head>
<body>
  <div class="container">
    <h1>ISCN Authenticator</h1>
    <main>${content}</main>
  </div>
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
