/**
 * ISCN Karyotype Validator - Deno Deploy Entry Point
 *
 * Wraps the shared `buildHandler` from `deno/lib/middleware.ts` with the
 * embedded HTML below. All security surface (auth, rate limit, security
 * headers, logging) lives in the shared handler -- local dev (server.ts)
 * and prod (this file) cannot drift.
 */

import { loadConfig } from "./lib/config.ts";
import { buildHandler } from "./lib/middleware.ts";

// Embedded static files for Deno Deploy
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ISCN Karyotype Validator</title>
  <style>
    :root {
      --color-bg: #f8f9fa;
      --color-surface: #ffffff;
      --color-text: #212529;
      --color-text-muted: #6c757d;
      --color-primary: #0d6efd;
      --color-primary-hover: #0b5ed7;
      --color-valid: #198754;
      --color-valid-bg: #d1e7dd;
      --color-invalid: #dc3545;
      --color-invalid-bg: #f8d7da;
      --color-border: #dee2e6;
      --font-mono: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
      --radius: 8px;
      --shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--color-bg);
      color: var(--color-text);
      line-height: 1.6;
      min-height: 100vh;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem 1rem;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header { text-align: center; margin-bottom: 2rem; }
    h1 { font-size: 2rem; font-weight: 600; margin-bottom: 0.5rem; }
    .subtitle { color: var(--color-text-muted); font-size: 1rem; }
    main {
      flex: 1;
      background: var(--color-surface);
      border-radius: var(--radius);
      padding: 2rem;
      box-shadow: var(--shadow);
    }
    .input-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .input-group label { font-weight: 500; font-size: 0.875rem; }
    .input-group input {
      font-family: var(--font-mono);
      font-size: 1.125rem;
      padding: 0.75rem 1rem;
      border: 2px solid var(--color-border);
      border-radius: var(--radius);
      outline: none;
      transition: border-color 0.2s;
    }
    .input-group input:focus { border-color: var(--color-primary); }
    .input-group button {
      background: var(--color-primary);
      color: white;
      font-size: 1rem;
      font-weight: 500;
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: var(--radius);
      cursor: pointer;
      transition: background-color 0.2s;
    }
    .input-group button:hover:not(:disabled) { background: var(--color-primary-hover); }
    .input-group button:disabled { opacity: 0.6; cursor: not-allowed; }
    .examples {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      margin-bottom: 1.5rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--color-border);
    }
    .examples-label { font-size: 0.875rem; color: var(--color-text-muted); }
    .examples button {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: 4px;
      cursor: pointer;
    }
    .examples button:hover { background: var(--color-surface); border-color: var(--color-primary); }
    .result { margin-top: 1.5rem; }
    .hidden { display: none !important; }
    .badge {
      display: inline-block;
      font-size: 1.25rem;
      font-weight: 600;
      padding: 0.5rem 1.5rem;
      border-radius: var(--radius);
      margin-bottom: 1rem;
    }
    .badge.valid { background: var(--color-valid-bg); color: var(--color-valid); }
    .badge.invalid { background: var(--color-invalid-bg); color: var(--color-invalid); }
    .errors {
      background: var(--color-invalid-bg);
      border: 1px solid var(--color-invalid);
      border-radius: var(--radius);
      padding: 1rem;
      margin-bottom: 1rem;
    }
    .errors h3 { font-size: 0.875rem; font-weight: 600; color: var(--color-invalid); margin-bottom: 0.5rem; }
    .errors ul { list-style: disc inside; font-size: 0.875rem; }
    .parsed-details {
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
    }
    .parsed-details summary { padding: 0.75rem 1rem; cursor: pointer; font-weight: 500; }
    #parsed-content { padding: 1rem; border-top: 1px solid var(--color-border); }
    #parsed-content dl { display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1rem; }
    #parsed-content dt { font-weight: 500; color: var(--color-text-muted); font-size: 0.875rem; }
    #parsed-content dd { font-family: var(--font-mono); font-size: 0.875rem; }
    #parsed-content code { background: var(--color-surface); padding: 0.125rem 0.375rem; border-radius: 4px; }
    footer { text-align: center; padding: 2rem 0 1rem; font-size: 0.875rem; color: var(--color-text-muted); }
    footer a { color: var(--color-primary); text-decoration: none; }
    .api-key-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; }
    .api-key-row label { font-weight: 500; font-size: 0.875rem; flex: 0 0 auto; }
    .api-key-row input { flex: 1 1 240px; font-family: var(--font-mono); font-size: 0.875rem; padding: 0.5rem 0.75rem; border: 2px solid var(--color-border); border-radius: var(--radius); outline: none; transition: border-color 0.2s; }
    .api-key-row input:focus { border-color: var(--color-primary); }
    .api-key-row button { font-size: 0.75rem; padding: 0.4rem 0.75rem; background: var(--color-bg); color: var(--color-text); border: 1px solid var(--color-border); border-radius: var(--radius); cursor: pointer; transition: background-color 0.2s, border-color 0.2s; }
    .api-key-row button:hover { background: var(--color-surface); border-color: var(--color-primary); }
    .api-key-hint { font-size: 0.8125rem; color: var(--color-text-muted); margin-bottom: 1.25rem; }
    .api-key-hint code { font-family: var(--font-mono); font-size: 0.8125rem; background: var(--color-bg); padding: 0.05rem 0.3rem; border-radius: 3px; }
    .api-docs { margin-top: 1.5rem; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: var(--radius); }
    .api-docs summary { padding: 0.75rem 1rem; cursor: pointer; font-weight: 500; }
    .api-docs-body { padding: 0 1rem 1rem; font-size: 0.875rem; }
    .api-docs-body p { color: var(--color-text-muted); margin-bottom: 0.75rem; }
    .api-docs-body pre { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 0.75rem 1rem; overflow-x: auto; font-family: var(--font-mono); font-size: 0.8125rem; line-height: 1.5; }
    .api-docs-body code { font-family: var(--font-mono); }
    @media (min-width: 640px) {
      .input-group { flex-direction: row; align-items: flex-end; }
      .input-group label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
      .input-group input { flex: 1; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>ISCN Karyotype Validator</h1>
      <p class="subtitle">Validate International System for Human Cytogenomic Nomenclature strings</p>
    </header>
    <main>
      <div class="api-key-row">
        <label for="api-key">API Key</label>
        <input type="password" id="api-key" placeholder="iscn_live_... (stored locally in your browser)" autocomplete="off" spellcheck="false">
        <button type="button" id="toggle-key-btn" onclick="toggleKeyVisibility()" aria-label="Show/hide API key">Show</button>
        <button type="button" onclick="clearKey()" aria-label="Clear stored API key">Clear</button>
      </div>
      <p class="api-key-hint">Required. Contact an administrator to obtain a key. The key is saved in your browser's localStorage and never transmitted except as a Bearer token to <code>/validate</code>.</p>
      <form id="validate-form" onsubmit="validate(event)">
        <div class="input-group">
          <label for="karyotype">Karyotype String</label>
          <input type="text" id="karyotype" name="karyotype" placeholder="e.g., 46,XX or 47,XY,+21" autocomplete="off" spellcheck="false" required>
          <button type="submit" id="submit-btn">Validate</button>
        </div>
      </form>
      <div class="examples">
        <span class="examples-label">Examples:</span>
        <button type="button" onclick="setExample('46,XX')">Normal female</button>
        <button type="button" onclick="setExample('46,XY')">Normal male</button>
        <button type="button" onclick="setExample('47,XY,+21')">Trisomy 21</button>
        <button type="button" onclick="setExample('45,X')">Turner</button>
        <button type="button" onclick="setExample('46,XX,del(5)(q13q33)')">Deletion</button>
        <button type="button" onclick="setExample('46,XX,t(9;22)(q34;q11)')">Translocation</button>
      </div>
      <div id="result" class="result hidden">
        <div id="result-badge" class="badge"></div>
        <div id="errors" class="errors hidden"></div>
        <details id="parsed-details" class="parsed-details">
          <summary>Parsed Details</summary>
          <div id="parsed-content"></div>
        </details>
      </div>
      <details class="api-docs">
        <summary>API usage (curl)</summary>
        <div class="api-docs-body">
          <p>All <code>/validate</code> calls require a Bearer token or <code>X-API-Key</code> header. Rate-limit headers are returned on every authenticated response.</p>
          <pre><code># POST (JSON body)
curl -X POST https://your-host/validate \\
  -H "Authorization: Bearer iscn_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"karyotype": "46,XX"}'

# GET (query parameter)
curl -H "Authorization: Bearer iscn_live_..." \\
  'https://your-host/validate?karyotype=46,XX'

# Error responses:
# 401 unauthenticated  429 rate_limited (+ Retry-After)
# 413 body_too_large   400 invalid_request</code></pre>
        </div>
      </details>
    </main>
    <footer>
      <p>Based on <a href="https://www.karger.com/Book/Home/282576" target="_blank">ISCN 2024</a> - International System for Human Cytogenomic Nomenclature</p>
    </footer>
  </div>
  <script>
    const input = document.getElementById('karyotype');
    const submitBtn = document.getElementById('submit-btn');
    const resultDiv = document.getElementById('result');
    const badgeDiv = document.getElementById('result-badge');
    const errorsDiv = document.getElementById('errors');
    const parsedDetails = document.getElementById('parsed-details');
    const parsedContent = document.getElementById('parsed-content');
    const apiKeyInput = document.getElementById('api-key');
    const toggleKeyBtn = document.getElementById('toggle-key-btn');
    const API_KEY_STORAGE = 'iscn.api_key';

    try { const s = localStorage.getItem(API_KEY_STORAGE); if (s) apiKeyInput.value = s; } catch {}
    apiKeyInput.addEventListener('change', () => {
      try {
        if (apiKeyInput.value) localStorage.setItem(API_KEY_STORAGE, apiKeyInput.value);
        else localStorage.removeItem(API_KEY_STORAGE);
      } catch {}
    });
    function toggleKeyVisibility() {
      if (apiKeyInput.type === 'password') { apiKeyInput.type = 'text'; toggleKeyBtn.textContent = 'Hide'; }
      else { apiKeyInput.type = 'password'; toggleKeyBtn.textContent = 'Show'; }
    }
    function clearKey() {
      apiKeyInput.value = '';
      try { localStorage.removeItem(API_KEY_STORAGE); } catch {}
      apiKeyInput.focus();
    }

    function setExample(k) { input.value = k; input.focus(); }

    async function validate(e) {
      e.preventDefault();
      const karyotype = input.value.trim();
      if (!karyotype) return;
      const apiKey = apiKeyInput.value.trim();
      if (!apiKey) {
        displayResult({ valid: false, errors: ['API key required. Paste a key in the API Key field above.'], parsed: null });
        apiKeyInput.focus();
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Validating...';
      resultDiv.classList.add('hidden');
      try {
        const res = await fetch('/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
          body: JSON.stringify({ karyotype })
        });
        const body = await res.json();
        if (res.status === 401) {
          displayResult({ valid: false, errors: ['Authentication failed: ' + (body.message || 'invalid or revoked key')], parsed: null });
          return;
        }
        if (res.status === 429) {
          const ra = res.headers.get('Retry-After') || '?';
          displayResult({ valid: false, errors: ['Rate limit exceeded. Retry after ' + ra + 's.'], parsed: null });
          return;
        }
        displayResult(body);
      } catch {
        displayResult({ valid: false, errors: ['Failed to connect'], parsed: null });
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Validate';
      }
    }

    function displayResult(r) {
      resultDiv.classList.remove('hidden');
      badgeDiv.textContent = r.valid ? 'VALID' : 'INVALID';
      badgeDiv.className = 'badge ' + (r.valid ? 'valid' : 'invalid');
      if (r.errors?.length) {
        errorsDiv.classList.remove('hidden');
        errorsDiv.innerHTML = '<h3>Errors</h3><ul>' + r.errors.map(e => '<li>' + esc(e) + '</li>').join('') + '</ul>';
      } else {
        errorsDiv.classList.add('hidden');
      }
      if (r.parsed) {
        parsedDetails.classList.remove('hidden');
        parsedContent.innerHTML = formatParsed(r.parsed);
        if (r.valid) parsedDetails.open = true;
      } else {
        parsedDetails.classList.add('hidden');
      }
    }

    function formatParsed(p) {
      let h = '<dl><dt>Chromosome Count</dt><dd>' + p.chromosome_count + '</dd>';
      h += '<dt>Sex Chromosomes</dt><dd>' + p.sex_chromosomes + '</dd>';
      if (p.abnormalities?.length) {
        h += '<dt>Abnormalities</dt><dd><ul>';
        p.abnormalities.forEach(a => { h += '<li><code>' + esc(a.raw) + '</code></li>'; });
        h += '</ul></dd>';
      } else {
        h += '<dt>Abnormalities</dt><dd>None</dd>';
      }
      return h + '</dl>';
    }

    function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    if (apiKeyInput.value) input.focus(); else apiKeyInput.focus();
  </script>
</body>
</html>`;

const config = loadConfig();
const kv = await Deno.openKv(config.kvPath ?? undefined);

const handler = buildHandler({ kv, config, staticHtml: INDEX_HTML });

Deno.serve(handler);
