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
import { createAxiomSink, tee } from "./lib/axiom.ts";

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
      <p class="api-key-hint">Required. <a href="/signup">Sign up</a> for a free key, or contact an administrator. The key is saved in your browser's localStorage and never transmitted except as a Bearer token to <code>/validate</code>.</p>
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
  
  <script type="module">
    import { validateKaryotypeNative, explain } from "/static/iscn-core.js";

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

    // Restore key for other API features if needed
    try { const s = localStorage.getItem(API_KEY_STORAGE); if (s) apiKeyInput.value = s; } catch {}
    apiKeyInput.addEventListener('change', () => {
      try {
        if (apiKeyInput.value) localStorage.setItem(API_KEY_STORAGE, apiKeyInput.value);
        else localStorage.removeItem(API_KEY_STORAGE);
      } catch {}
    });

    window.toggleKeyVisibility = () => {
      if (apiKeyInput.type === 'password') { apiKeyInput.type = 'text'; toggleKeyBtn.textContent = 'Hide'; }
      else { apiKeyInput.type = 'password'; toggleKeyBtn.textContent = 'Show'; }
    };
    window.clearKey = () => {
      apiKeyInput.value = '';
      try { localStorage.removeItem(API_KEY_STORAGE); } catch {}
      apiKeyInput.focus();
    };
    window.setExample = (k) => { input.value = k; input.focus(); };

    window.validate = async (e) => {
      if (e) e.preventDefault();
      const karyotype = input.value.trim();
      if (!karyotype) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Validating...';
      
      const onMiss = (signature) => {
        fetch('/explain/miss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signature })
        }).catch(() => {}); // Best effort
      };

      try {
        const result = validateKaryotypeNative(karyotype);
        if (result.parsed) {
          result.explanation = explain(result.parsed, { onMiss });
          result.parsed.abnormalities.forEach(abn => {
            abn.explanation = explain(abn, { onMiss });
          });
        }
        displayResult(result);
      } catch (err) {
        displayResult({ valid: false, errors: ['Local validation error: ' + err.message], parsed: null });
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Validate';
      }
    };

    // Attach to form
    document.getElementById('validate-form').onsubmit = window.validate;

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
        parsedContent.innerHTML = formatParsed(r.parsed, r.explanation);
        if (r.valid) parsedDetails.open = true;
      } else {
        parsedDetails.classList.add('hidden');
      }
    }

    function formatParsed(p, exp) {
      let h = '<dl>';
      if (exp) {
        h += '<dt>Summary</dt><dd><strong>' + esc(exp.summary) + '</strong></dd>';
        if (exp.detail) {
          h += '<dt>Details</dt><dd>' + esc(exp.detail) + '</dd>';
        }
        if (exp.citation) {
          h += '<dt>Citation</dt><dd>ISCN 2024 § ' + exp.citation.section + (exp.citation.page ? ', p. ' + exp.citation.page : '') + '</dd>';
        }
      }
      h += '<dt>Chromosome Count</dt><dd>' + p.chromosome_count + '</dd>';
      h += '<dt>Sex Chromosomes</dt><dd>' + p.sex_chromosomes + '</dd>';
      if (p.abnormalities?.length) {
        h += '<dt>Abnormalities</dt><dd><ul>';
        p.abnormalities.forEach(a => {
          h += '<li><code>' + esc(a.raw) + '</code>';
          if (a.explanation) {
            h += '<br><small style="color: var(--color-text-muted)">' + esc(a.explanation.summary) + '</small>';
          }
          h += '</li>';
        });
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

// When both Axiom env vars are set, tee every request log line to Axiom
// alongside stdout. Missing either → stdout only (Deno Deploy still retains
// ~24h of console output so observability is not lost).
let logSink: ((line: string) => void) | undefined;
if (config.axiomApiToken && config.axiomDataset) {
  const axiom = createAxiomSink({
    token: config.axiomApiToken,
    dataset: config.axiomDataset,
  });
  logSink = tee((line) => console.log(line), axiom.log);
}

const staticAssets = {
  "/static/iscn-core.js": `var q=/^(.+?)\[(\d+)\]\$/,p=class extends Error{constructor(t){super(t),this.name="ParseError"}},d=class{SEX_CHROMOSOMES_PATTERN=/^[XYU]+\$/;NUMERICAL_ABNORMALITY_PATTERN=/^([+-])(\d{1,2}|[XY])\$/;DELETION_PATTERN=/^del\((\d{1,2}|[XY])\)\(([^)]+)\)\$/;DUPLICATION_PATTERN=/^dup\((\d{1,2}|[XY])\)\(([^)]+)\)\$/;INVERSION_PATTERN=/^inv\((\d{1,2}|[XY])\)\(([^)]+)\)\$/;TRANSLOCATION_PATTERN=/^t\(([^)]+)\)\(([^)]+)\)\$/;BREAKPOINT_PATTERN=/^([pq])(\d+)(?:\.(\d+))?(\?)?\$/;ISOCHROMOSOME_SHORT_PATTERN=/^i\((\d{1,2}|[XY])([pq])\)\$/;ISOCHROMOSOME_LONG_PATTERN=/^i\((\d{1,2}|[XY])\)\(([^)]+)\)\$/;RING_SIMPLE_PATTERN=/^r\((\d{1,2}|[XY])\)\$/;RING_BREAKPOINT_PATTERN=/^r\((\d{1,2}|[XY])\)\(([^)]+)\)\$/;MARKER_PATTERN=/^\+(\d*)mar(\d*)\$/;DERIVATIVE_PATTERN=/^der\((\d{1,2}|[XY])\)(.+)\$/;DMIN_PATTERN=/^dmin\$/;HSR_SIMPLE_PATTERN=/^hsr\$/;HSR_LOCATION_PATTERN=/^hsr\((\d{1,2}|[XY])\)\(([^)]+)\)\$/;INSERTION_PATTERN=/^ins\(([^)]+)\)\(([^)]+)\)\$/;ADD_PATTERN=/^add\((\d{1,2}|[XY])\)\(([^)]+)\)\$/;TRIPLICATION_PATTERN=/^trp\((\d{1,2}|[XY])\)\(([^)]+)\)\$/;DICENTRIC_PATTERN=/^dic\(([^)]+)\)\(([^)]+)\)\$/;ISODICENTRIC_PATTERN=/^idic\((\d{1,2}|[XY])\)\(([^)]+)\)\$/;FRAGILE_SITE_PATTERN=/^fra\((\d{1,2}|[XY])\)\(([^)]+)\)\$/;ROBERTSONIAN_PATTERN=/^rob\(([^)]+)\)\(([^)]+)\)\$/;QUADRUPLICATION_PATTERN=/^qdp\((\d{1,2}|[XY])\)\(([^)]+)\)\$/;PSEUDODICENTRIC_PATTERN=/^psu\s*dic\(([^)]+)\)\(([^)]+)\)\$/;ACENTRIC_PATTERN=/^ace\((\d{1,2}|[XY])\)\(([^)]+)\)\$/;TELOMERIC_ASSOC_PATTERN=/^tas\(([^)]+)\)\(([^)]+)\)\$/;FISSION_PATTERN=/^fis\((\d{1,2}|[XY])\)\(([^)]+)\)\$/;NEOCENTROMERE_PATTERN=/^neo\((\d{1,2}|[XY])\)\(([^)]+)\)\$/;INCOMPLETE_PATTERN=/^inc\$/;RECOMBINANT_PATTERN=/^rec\((\d{1,2}|[XY])\)(.+)\$/;UPD_PATTERN=/^upd\((\d{1,2}|[XY])\)(mat|pat)?\$/;NUMERICAL_CONSTITUTIONAL_PATTERN=/^([+-])(\d{1,2}|[XY])(c)?\$/;COMPLEX_PATTERN=/^cpx\(([^)]+)\)\$/;CHROMOTHRIPSIS_PATTERN=/^cth\(([^)]+)\)\$/;CHROMOPLEXY_PATTERN=/^cpy\(([^)]+)\)\$/;parse(t){if(!t||!t.trim())throw new p("Karyotype string is empty");if(t=t.trim(),t.startsWith("nuc ish ")){let u=t.slice(8);return{chromosome_count:null,sex_chromosomes:"",abnormalities:[],cell_lines:null,modifiers:{ish:u,interphase:!0}}}let e=null,o=null,n=null;if(t.includes(".ish ")){let u=t.indexOf(".ish ");e=t.slice(u+5),t=t.slice(0,u)}else if(t.includes(".arr")){let u=t.indexOf(".arr");o=t.slice(u+4),t=t.slice(0,u)}else if(t.includes(".ogm")){let u=t.indexOf(".ogm");n=t.slice(u+4),t=t.slice(0,u)}let s=null,a=t.match(/\.cp\[(\d+)\]\$/);a&&(s=parseInt(a[1],10),t=t.slice(0,-a[0].length));let m=!1;t.startsWith("chi ")&&(m=!0,t=t.slice(4));let c;return t.includes("/")?c=this.parseMosaic(t):c=this.parseSingleKaryotype(t,!1),(e||o||n||s!==null||m)&&(c.modifiers=c.modifiers||{},e&&(c.modifiers.ish=e),o&&(c.modifiers.arr=o),n&&(c.modifiers.ogm=n),s!==null&&(c.modifiers.composite=s),m&&(c.modifiers.chimera=!0)),c}parseSingleKaryotype(t,e=!1){let o=0;if(e){let u=t.match(q);u&&(t=u[1],o=parseInt(u[2],10))}if(!t.includes(","))throw new p("Missing comma separator between chromosome count and sex chromosomes");let n=t.split(","),s=this.parseChromosomeCount(n[0]),a=this.parseSexChromosomes(n[1]),m=n.length>2?this.parseAbnormalities(n.slice(2)):[],c={chromosome_count:s,sex_chromosomes:a,abnormalities:m,cell_lines:null,modifiers:null};return e?{ast:c,count:o}:c}parseMosaic(t){let e=t.split("/"),o=[];for(let s of e){let a=this.parseSingleKaryotype(s.trim(),!0),m={chromosome_count:a.ast.chromosome_count,sex_chromosomes:a.ast.sex_chromosomes,abnormalities:a.ast.abnormalities,count:a.count,is_donor:!1};o.push(m)}let n=o[0];return{chromosome_count:n.chromosome_count,sex_chromosomes:n.sex_chromosomes,abnormalities:n.abnormalities,cell_lines:o,modifiers:null}}parseChromosomeCount(t){if(t=t.trim(),t.includes("~"))return t;if(!/^\d+\$/.test(t))throw new p(\`Invalid chromosome count: '\${t}' is not a number\`);return parseInt(t,10)}parseSexChromosomes(t){if(t=t.trim(),!this.SEX_CHROMOSOMES_PATTERN.test(t))throw new p(\`Invalid sex chromosomes: '\${t}' must contain only X, Y, or U\`);return t}parseBreakpoint(t){let e=t.match(this.BREAKPOINT_PATTERN);if(!e)throw new p(\`Invalid breakpoint format: '\${t}'\`);let o=e[1],n=e[2],s=e[3]||null,a=e[4]==="?",m,c;return n.length>=2?(m=parseInt(n[0],10),c=parseInt(n.slice(1),10)):(m=parseInt(n,10),c=0),{arm:o,region:m,band:c,subband:s,uncertain:a}}parseBreakpoints(t){let e=[],o=t.match(/^([pq]\d+(?:\.\d+)?\??)([pq]\d+(?:\.\d+)?\??)\$/);return o?(e.push(this.parseBreakpoint(o[1])),e.push(this.parseBreakpoint(o[2]))):e.push(this.parseBreakpoint(t)),e}parseMultipleBreakpoints(t){return t.split(";").map(o=>this.parseBreakpoint(o.trim()))}parseDeletion(t){let e=t.match(this.DELETION_PATTERN);if(!e)throw new p(\`Invalid deletion format: '\${t}'\`);let o=e[1],n=e[2],s=this.parseBreakpoints(n);return{type:"del",chromosome:o,breakpoints:s,inheritance:null,uncertain:!1,copy_count:null,raw:t}}parseDuplication(t){let e=t.match(this.DUPLICATION_PATTERN);if(!e)throw new p(\`Invalid duplication format: '\${t}'\`);let o=e[1],n=e[2],s=this.parseBreakpoints(n);return{type:"dup",chromosome:o,breakpoints:s,inheritance:null,uncertain:!1,copy_count:null,raw:t}}parseInversion(t){let e=t.match(this.INVERSION_PATTERN);if(!e)throw new p(\`Invalid inversion format: '\${t}'\`);let o=e[1],s=e[2].match(/^([pq]\d+(?:\.\d+)?)([pq]\d+(?:\.\d+)?)\$/);if(!s)throw new p(\`Inversion requires two breakpoints: '\${t}'\`);let a=[this.parseBreakpoint(s[1]),this.parseBreakpoint(s[2])];return{type:"inv",chromosome:o,breakpoints:a,inheritance:null,uncertain:!1,copy_count:null,raw:t}}parseTranslocation(t){let e=t.match(this.TRANSLOCATION_PATTERN);if(!e)throw new p(\`Invalid translocation format: '\${t}'\`);let o=e[1],a=e[2].split(";").map(m=>this.parseBreakpoint(m.trim()));return{type:"t",chromosome:o,breakpoints:a,inheritance:null,uncertain:!1,copy_count:null,raw:t}}parseIsochromosome(t){let e=t.match(this.ISOCHROMOSOME_SHORT_PATTERN);if(e){let n=e[1],a={arm:e[2],region:1,band:0,subband:null,uncertain:!1};return{type:"i",chromosome:n,breakpoints:[a],inheritance:null,uncertain:!1,copy_count:null,raw:t}}let o=t.match(this.ISOCHROMOSOME_LONG_PATTERN);if(o){let n=o[1],s=o[2],a=this.parseBreakpoint(s);return{type:"i",chromosome:n,breakpoints:[a],inheritance:null,uncertain:!1,copy_count:null,raw:t}}throw new p(\`Invalid isochromosome format: '\${t}'\`)}parseRing(t){let e=t.match(this.RING_SIMPLE_PATTERN);if(e)return{type:"r",chromosome:e[1],breakpoints:[],inheritance:null,uncertain:!1,copy_count:null,raw:t};let o=t.match(this.RING_BREAKPOINT_PATTERN);if(o){let n=o[1],s=o[2],a=this.parseBreakpoints(s);return{type:"r",chromosome:n,breakpoints:a,inheritance:null,uncertain:!1,copy_count:null,raw:t}}throw new p(\`Invalid ring chromosome format: '\${t}'\`)}parseInsertion(t){let e=t.match(this.INSERTION_PATTERN);if(!e)throw new p(\`Invalid insertion format: '\${t}'\`);let o=e[1],n=e[2],s=[];if(n.includes(";")){let a=n.split(";");s.push(this.parseBreakpoint(a[0].trim()));let m=a[1].trim(),c=m.match(/^([pq]\d+(?:\.\d+)?)([pq]\d+(?:\.\d+)?)\$/);c?(s.push(this.parseBreakpoint(c[1])),s.push(this.parseBreakpoint(c[2]))):s.push(this.parseBreakpoint(m))}else{let a=n.match(/^([pq]\d+(?:\.\d+)?)([pq]\d+(?:\.\d+)?)([pq]\d+(?:\.\d+)?)\$/);if(a)s.push(this.parseBreakpoint(a[1])),s.push(this.parseBreakpoint(a[2])),s.push(this.parseBreakpoint(a[3]));else throw new p(\`Invalid insertion breakpoints: '\${n}'\`)}return{type:"ins",chromosome:o,breakpoints:s,inheritance:null,uncertain:!1,copy_count:null,raw:t}}parseAdd(t){let e=t.match(this.ADD_PATTERN);if(!e)throw new p(\`Invalid additional material format: '\${t}'\`);let o=e[1],n=e[2],s=this.parseBreakpoint(n);return{type:"add",chromosome:o,breakpoints:[s],inheritance:null,uncertain:!1,copy_count:null,raw:t}}parseTriplication(t){let e=t.match(this.TRIPLICATION_PATTERN);if(!e)throw new p(\`Invalid triplication format: '\${t}'\`);let o=e[1],s=e[2].match(/^([pq]\d+(?:\.\d+)?)([pq]\d+(?:\.\d+)?)\$/);if(!s)throw new p(\`Triplication requires two breakpoints: '\${t}'\`);let a=[this.parseBreakpoint(s[1]),this.parseBreakpoint(s[2])];return{type:"trp",chromosome:o,breakpoints:a,inheritance:null,uncertain:!1,copy_count:null,raw:t}}parseDicentric(t){let e=t.match(this.DICENTRIC_PATTERN);if(!e)throw new p(\`Invalid dicentric format: '\${t}'\`);let o=e[1],a=e[2].split(";").map(m=>this.parseBreakpoint(m.trim()));return{type:"dic",chromosome:o,breakpoints:a,inheritance:null,uncertain:!1,copy_count:null,raw:t}}parseIsodicentric(t){let e=t.match(this.ISODICENTRIC_PATTERN);if(!e)throw new p(\`Invalid isodicentric format: '\${t}'\`);let o=e[1],n=e[2],s=this.parseBreakpoint(n);return{type:"idic",chromosome:o,breakpoints:[s],inheritance:null,uncertain:!1,copy_count:null,raw:t}}parseFragileSite(t){let e=t.match(this.FRAGILE_SITE_PATTERN);if(!e)throw new p(\`Invalid fragile site format: '\${t}'\`);let o=e[1],n=e[2],s=this.parseBreakpoint(n);return{type:"fra",chromosome:o,breakpoints:[s],inheritance:null,uncertain:!1,copy_count:null,raw:t}}parseRobertsonian(t){let e=t.match(this.ROBERTSONIAN_PATTERN);if(!e)throw new p(\`Invalid Robertsonian translocation format: '\${t}'\`);let o=e[1],a=e[2].split(";").map(m=>this.parseBreakpoint(m.trim()));return{type:"rob",chromosome:o,breakpoints:a,inheritance:null,uncertain:!1,copy_count:null,raw:t}}parseQuadruplication(t){let e=t.match(this.QUADRUPLICATION_PATTERN);if(!e)throw new p(\`Invalid quadruplication format: '\${t}'\`);let o=e[1],s=e[2].match(/^([pq]\d+(?:\.\d+)?)([pq]\d+(?:\.\d+)?)\$/);if(!s)throw new p(\`Quadruplication requires two breakpoints: '\${t}'\`);let a=[this.parseBreakpoint(s[1]),this.parseBreakpoint(s[2])];return{type:"qdp",chromosome:o,breakpoints:a,inheritance:null,uncertain:!1,copy_count:null,raw:t}}parseAbnormalities(t){let e=[];for(let o of t){if(o=o.trim(),!o)continue;let n=!1,s=o;o.startsWith("?")&&(n=!0,o=o.slice(1));let a=null,m=o.match(/x(\d+)\$/);m&&(a=parseInt(m[1],10),o=o.slice(0,-m[0].length));let c=null;o.endsWith("umat")?(c="umat",o=o.slice(0,-4)):o.endsWith("upat")?(c="upat",o=o.slice(0,-4)):o.endsWith("mat")?(c="mat",o=o.slice(0,-3)):o.endsWith("pat")?(c="pat",o=o.slice(0,-3)):o.endsWith("dn")&&(c="dn",o=o.slice(0,-2));let u=o.match(this.NUMERICAL_CONSTITUTIONAL_PATTERN);if(u){let i=u[3]==="c";e.push({type:u[1]+(i?"c":""),chromosome:u[2],breakpoints:[],inheritance:c,uncertain:n,copy_count:a,raw:s});continue}if(o==="idem"){e.push({type:"idem",chromosome:"",breakpoints:[],inheritance:c,uncertain:n,copy_count:a,raw:s});continue}if(o==="sl"||o==="sdl"){e.push({type:o,chromosome:"",breakpoints:[],inheritance:c,uncertain:n,copy_count:a,raw:s});continue}if(o.startsWith("del(")){let i=this.parseDeletion(o);i.uncertain=n,i.inheritance=c,i.copy_count=a,i.raw=s,e.push(i);continue}if(o.startsWith("add(")){let i=this.parseAdd(o);i.uncertain=n,i.inheritance=c,i.copy_count=a,i.raw=s,e.push(i);continue}if(o.startsWith("dup(")){let i=this.parseDuplication(o);i.uncertain=n,i.inheritance=c,i.copy_count=a,i.raw=s,e.push(i);continue}if(o.startsWith("dic(")){let i=this.parseDicentric(o);i.uncertain=n,i.inheritance=c,i.copy_count=a,i.raw=s,e.push(i);continue}if(o.startsWith("idic(")){let i=this.parseIsodicentric(o);i.uncertain=n,i.inheritance=c,i.copy_count=a,i.raw=s,e.push(i);continue}if(o.startsWith("fra(")){let i=this.parseFragileSite(o);i.uncertain=n,i.inheritance=c,i.copy_count=a,i.raw=s,e.push(i);continue}if(o.startsWith("inv(")){let i=this.parseInversion(o);i.uncertain=n,i.inheritance=c,i.copy_count=a,i.raw=s,e.push(i);continue}if(o.startsWith("trp(")){let i=this.parseTriplication(o);i.uncertain=n,i.inheritance=c,i.copy_count=a,i.raw=s,e.push(i);continue}if(o.startsWith("qdp(")){let i=this.parseQuadruplication(o);i.uncertain=n,i.inheritance=c,i.copy_count=a,i.raw=s,e.push(i);continue}if(o.startsWith("t(")){let i=this.parseTranslocation(o);i.uncertain=n,i.inheritance=c,i.copy_count=a,i.raw=s,e.push(i);continue}if(o.startsWith("ins(")){let i=this.parseInsertion(o);i.uncertain=n,i.inheritance=c,i.copy_count=a,i.raw=s,e.push(i);continue}if(o.startsWith("i(")){let i=this.parseIsochromosome(o);i.uncertain=n,i.inheritance=c,i.copy_count=a,i.raw=s,e.push(i);continue}if(o.startsWith("rob(")){let i=this.parseRobertsonian(o);i.uncertain=n,i.inheritance=c,i.copy_count=a,i.raw=s,e.push(i);continue}if(o.startsWith("r(")){let i=this.parseRing(o);i.uncertain=n,i.inheritance=c,i.copy_count=a,i.raw=s,e.push(i);continue}let T=o.match(this.MARKER_PATTERN);if(T){let i=T[1],l=T[2],h=i?parseInt(i,10):null,D="mar"+(l||"");e.push({type:"+mar",chromosome:D,breakpoints:[],inheritance:c,uncertain:n,copy_count:h,raw:s});continue}let \$=o.match(this.DERIVATIVE_PATTERN);if(\$){let i=\$[1];e.push({type:"der",chromosome:i,breakpoints:[],inheritance:c,uncertain:n,copy_count:a,raw:s});continue}if(this.DMIN_PATTERN.test(o)){e.push({type:"dmin",chromosome:"",breakpoints:[],inheritance:c,uncertain:n,copy_count:a,raw:s});continue}let R=o.match(this.HSR_LOCATION_PATTERN);if(R){let i=R[1],l=R[2],h=this.parseBreakpoint(l);e.push({type:"hsr",chromosome:i,breakpoints:[h],inheritance:c,uncertain:n,copy_count:a,raw:s});continue}if(this.HSR_SIMPLE_PATTERN.test(o)){e.push({type:"hsr",chromosome:"",breakpoints:[],inheritance:c,uncertain:n,copy_count:a,raw:s});continue}let _=o.match(this.PSEUDODICENTRIC_PATTERN);if(_){let i=_[1],l=_[2],h=this.parseMultipleBreakpoints(l);e.push({type:"psu dic",chromosome:i,breakpoints:h,inheritance:c,uncertain:n,copy_count:a,raw:s});continue}let k=o.match(this.ACENTRIC_PATTERN);if(k){let i=k[1],l=k[2],h=this.parseBreakpoints(l);e.push({type:"ace",chromosome:i,breakpoints:h,inheritance:c,uncertain:n,copy_count:a,raw:s});continue}let g=o.match(this.TELOMERIC_ASSOC_PATTERN);if(g){let i=g[1],l=g[2],h=this.parseMultipleBreakpoints(l);e.push({type:"tas",chromosome:i,breakpoints:h,inheritance:c,uncertain:n,copy_count:a,raw:s});continue}let N=o.match(this.FISSION_PATTERN);if(N){let i=N[1],l=N[2],h=this.parseBreakpoint(l);e.push({type:"fis",chromosome:i,breakpoints:[h],inheritance:c,uncertain:n,copy_count:a,raw:s});continue}let v=o.match(this.NEOCENTROMERE_PATTERN);if(v){let i=v[1],l=v[2],h=this.parseBreakpoint(l);e.push({type:"neo",chromosome:i,breakpoints:[h],inheritance:c,uncertain:n,copy_count:a,raw:s});continue}if(this.INCOMPLETE_PATTERN.test(o)){e.push({type:"inc",chromosome:"",breakpoints:[],inheritance:c,uncertain:n,copy_count:a,raw:s});continue}let B=o.match(this.RECOMBINANT_PATTERN);if(B){e.push({type:"rec",chromosome:B[1],breakpoints:[],inheritance:c,uncertain:n,copy_count:a,raw:s});continue}let E=o.match(this.UPD_PATTERN);if(E){e.push({type:"upd",chromosome:E[1],breakpoints:[],inheritance:E[2]||c,uncertain:n,copy_count:a,raw:s});continue}let S=o.match(this.COMPLEX_PATTERN);if(S){e.push({type:"cpx",chromosome:S[1],breakpoints:[],inheritance:c,uncertain:n,copy_count:a,raw:s});continue}let w=o.match(this.CHROMOTHRIPSIS_PATTERN);if(w){e.push({type:"cth",chromosome:w[1],breakpoints:[],inheritance:c,uncertain:n,copy_count:a,raw:s});continue}let C=o.match(this.CHROMOPLEXY_PATTERN);if(C){e.push({type:"cpy",chromosome:C[1],breakpoints:[],inheritance:c,uncertain:n,copy_count:a,raw:s});continue}e.push({type:"unknown",chromosome:"",breakpoints:[],inheritance:c,uncertain:n,copy_count:a,raw:s})}return e}};var y=class{rules=[];abnormalityRules=[];addRule(t){this.rules.push(t)}addRules(t){this.rules.push(...t)}addAbnormalityRule(t){this.abnormalityRules.push(t)}addAbnormalityRules(t){this.abnormalityRules.push(...t)}validate(t){let e=[];for(let o of this.rules){let n=o.validate(t,t);e.push(...n)}for(let o of t.abnormalities)for(let n of this.abnormalityRules){let s=n.validate(t,o);e.push(...s)}return{valid:e.length===0,errors:e,parsed:t}}};function X(r){return r.chromosome_count===null?[]:typeof r.chromosome_count=="string"?r.chromosome_count.includes("~")?[]:[\`Chromosome count '\${r.chromosome_count}' is not numeric\`]:[]}function Y(r){let t=r.chromosome_count;return t===null?[]:typeof t=="string"?[]:t<23||t>92?[\`Chromosome count \${t} is outside valid range (must be between 23 and 92)\`]:[]}function U(r){let t=r.sex_chromosomes;return r.chromosome_count===null||t===""?[]:t==="U"?[]:t.includes("X")?[]:[\`Sex chromosomes '\${t}' must contain at least one X chromosome\`]}function H(r){let t=r.chromosome_count,e=r.sex_chromosomes;if(t===null||e==="")return[];if(typeof t=="string"||e==="U")return[];let o=e.length;if(!r.abnormalities||r.abnormalities.length===0){if(t===46&&o!==2)return[\`Chromosome count 46 requires 2 sex chromosomes, but found \${o} ('\${e}')\`];if(t===45&&o!==1)return[\`Chromosome count 45 requires 1 sex chromosome, but found \${o} ('\${e}')\`]}return[]}var W={id:"CHR_COUNT_NUMERIC",category:"chromosome_count",description:"Chromosome count must be numeric or valid range notation",validate:r=>X(r)},V={id:"CHR_COUNT_RANGE",category:"chromosome_count",description:"Chromosome count must be between 23 and 92",validate:r=>Y(r)},F={id:"SEX_CHR_VALID",category:"sex_chromosomes",description:"Sex chromosomes must contain at least one X",validate:r=>U(r)},j={id:"SEX_CHR_COHERENCE",category:"coherence",description:"Chromosome count must be coherent with sex chromosome count",validate:r=>H(r)},f=[W,V,F,j];var G=new Set(["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","X","Y"]);function Q(r,t){return t.type!=="+"&&t.type!=="-"?[]:G.has(t.chromosome)?[]:[\`Invalid chromosome '\${t.chromosome}' in \${t.raw}. Must be 1-22, X, or Y\`]}function z(r,t){if(t.type==="+"||t.type==="-"||t.type==="unknown")return[];let e=[];for(let o of t.breakpoints)o.arm!=="p"&&o.arm!=="q"&&e.push(\`Invalid breakpoint arm '\${o.arm}' in \${t.raw}. Must be 'p' or 'q'\`);return e}function J(r,t){if(t.type!=="inv")return[];let e=t.breakpoints.length;return e!==2?[\`Inversion requires two breakpoints, found \${e} in \${t.raw}\`]:[]}function Z(r,t){if(t.type!=="t")return[];let o=t.chromosome.split(";").length,n=t.breakpoints.length;return o!==n?[\`Translocation has \${o} chromosomes but \${n} breakpoints in \${t.raw}\`]:[]}function tt(r,t){if(t.type!=="del")return[];let e=t.breakpoints.length;if(e!==1&&e!==2)return[\`Deletion requires one or two breakpoints, found \${e} in \${t.raw}\`];if(e===2){let o=t.breakpoints[0].arm,n=t.breakpoints[1].arm;if(o!==n)return[\`Interstitial deletion breakpoints must be on same arm, found \${o} and \${n} in \${t.raw}\`]}return[]}function et(r,t){if(t.type!=="dup")return[];let e=t.breakpoints.length;if(e!==1&&e!==2)return[\`Duplication requires one or two breakpoints, found \${e} in \${t.raw}\`];if(e===2){let o=t.breakpoints[0].arm,n=t.breakpoints[1].arm;if(o!==n)return[\`Duplication breakpoints must be on same arm, found \${o} and \${n} in \${t.raw}\`]}return[]}function ot(r,t){if(t.type!=="r")return[];let e=t.breakpoints.length;if(e!==2)return[\`Ring chromosome requires two breakpoints, found \${e} in \${t.raw}\`];let o=t.breakpoints[0].arm,n=t.breakpoints[1].arm;return o===n?[\`Ring chromosome breakpoints must be on different arms, found \${o} and \${n} in \${t.raw}\`]:[]}function rt(r,t){if(t.type!=="i")return[];let e=t.breakpoints.length;return e!==1?[\`Isochromosome requires one breakpoint, found \${e} in \${t.raw}\`]:[]}function nt(r,t){if(t.type!=="trp")return[];let e=t.breakpoints.length;if(e!==2)return[\`Triplication requires two breakpoints, found \${e} in \${t.raw}\`];let o=t.breakpoints[0].arm,n=t.breakpoints[1].arm;return o!==n?[\`Triplication breakpoints must be on same arm, found \${o} and \${n} in \${t.raw}\`]:[]}function it(r,t){if(t.type!=="qdp")return[];let e=t.breakpoints.length;if(e!==2)return[\`Quadruplication requires two breakpoints, found \${e} in \${t.raw}\`];let o=t.breakpoints[0].arm,n=t.breakpoints[1].arm;return o!==n?[\`Quadruplication breakpoints must be on same arm, found \${o} and \${n} in \${t.raw}\`]:[]}function st(r,t){if(t.type!=="dic")return[];let o=t.chromosome.split(";").length,n=t.breakpoints.length;return o!==n?[\`Dicentric has \${o} chromosomes but \${n} breakpoints in \${t.raw}\`]:[]}function at(r,t){if(t.type!=="idic")return[];let e=t.breakpoints.length;return e!==1?[\`Isodicentric requires one breakpoint, found \${e} in \${t.raw}\`]:[]}function ct(r,t){if(t.type!=="rob")return[];let o=t.chromosome.split(";").length,n=t.breakpoints.length;return o!==n?[\`Robertsonian translocation has \${o} chromosomes but \${n} breakpoints in \${t.raw}\`]:[]}function pt(r,t){if(t.type!=="add")return[];let e=t.breakpoints.length;return e!==1?[\`Add requires one breakpoint, found \${e} in \${t.raw}\`]:[]}function mt(r,t){if(t.type!=="fra")return[];let e=t.breakpoints.length;return e!==1?[\`Fragile site requires one breakpoint, found \${e} in \${t.raw}\`]:[]}function ut(r,t){if(t.type!=="ins")return[];let e=t.breakpoints.length;return e!==3?[\`Insertion requires three breakpoints, found \${e} in \${t.raw}\`]:[]}function lt(r,t){if(t.type!=="dmin")return[];let e=t.breakpoints.length;return e!==0?[\`Double minutes should have no breakpoints, found \${e} in \${t.raw}\`]:[]}function ht(r,t){if(t.type!=="hsr")return[];let e=t.breakpoints.length;return e>1?[\`HSR should have zero or one breakpoint, found \${e} in \${t.raw}\`]:[]}function dt(r,t){if(t.type!=="mar")return[];let e=t.breakpoints.length;return e!==0?[\`Marker chromosome should have no breakpoints, found \${e} in \${t.raw}\`]:[]}function yt(r,t){if(t.type!=="psu dic")return[];let o=t.chromosome.split(";").length,n=t.breakpoints.length;return o!==n?[\`Pseudodicentric has \${o} chromosomes but \${n} breakpoints in \${t.raw}\`]:[]}function ft(r,t){if(t.type!=="ace")return[];let e=t.breakpoints.length;return e!==1&&e!==2?[\`Acentric fragment requires 1-2 breakpoints, found \${e} in \${t.raw}\`]:[]}function bt(r,t){if(t.type!=="tas")return[];let o=t.chromosome.split(";").length,n=t.breakpoints.length;return o!==n?[\`Telomeric association has \${o} chromosomes but \${n} breakpoints in \${t.raw}\`]:[]}function At(r,t){if(t.type!=="fis")return[];let e=t.breakpoints.length;return e!==1?[\`Fission requires one breakpoint, found \${e} in \${t.raw}\`]:[]}function Tt(r,t){if(t.type!=="neo")return[];let e=t.breakpoints.length;return e!==1?[\`Neocentromere requires one breakpoint, found \${e} in \${t.raw}\`]:[]}function Rt(r,t){if(t.type!=="inc")return[];let e=t.breakpoints.length;return e!==0?[\`Incomplete karyotype marker should have no breakpoints, found \${e} in \${t.raw}\`]:[]}var _t={id:"ABN_NUM_CHR_VALID",category:"abnormality",description:"Numerical abnormality chromosome must be 1-22, X, or Y",validate:(r,t)=>Q(r,t)},kt={id:"ABN_BP_ARM_VALID",category:"abnormality",description:"Breakpoint arm must be 'p' or 'q'",validate:(r,t)=>z(r,t)},gt={id:"ABN_INV_TWO_BP",category:"abnormality",description:"Inversion must have exactly two breakpoints",validate:(r,t)=>J(r,t)},Nt={id:"ABN_TRANS_BP_COUNT",category:"abnormality",description:"Translocation breakpoint count must match chromosome count",validate:(r,t)=>Z(r,t)},vt={id:"ABN_DEL_BP",category:"abnormality",description:"Deletion must have 1-2 breakpoints, interstitial requires same arm",validate:(r,t)=>tt(r,t)},Et={id:"ABN_DUP_BP",category:"abnormality",description:"Duplication must have 1-2 breakpoints, interstitial requires same arm",validate:(r,t)=>et(r,t)},It={id:"ABN_RING_BP",category:"abnormality",description:"Ring chromosome must have 2 breakpoints on different arms",validate:(r,t)=>ot(r,t)},\$t={id:"ABN_ISO_BP",category:"abnormality",description:"Isochromosome must have exactly 1 breakpoint",validate:(r,t)=>rt(r,t)},Bt={id:"ABN_TRP_BP",category:"abnormality",description:"Triplication must have 2 breakpoints on same arm",validate:(r,t)=>nt(r,t)},St={id:"ABN_QDP_BP",category:"abnormality",description:"Quadruplication must have 2 breakpoints on same arm",validate:(r,t)=>it(r,t)},wt={id:"ABN_DIC_BP",category:"abnormality",description:"Dicentric breakpoint count must match chromosome count",validate:(r,t)=>st(r,t)},Ct={id:"ABN_IDIC_BP",category:"abnormality",description:"Isodicentric must have exactly 1 breakpoint",validate:(r,t)=>at(r,t)},Pt={id:"ABN_ROB_BP",category:"abnormality",description:"Robertsonian translocation breakpoint count must match chromosome count",validate:(r,t)=>ct(r,t)},Ot={id:"ABN_ADD_BP",category:"abnormality",description:"Add (additional material) must have exactly 1 breakpoint",validate:(r,t)=>pt(r,t)},xt={id:"ABN_FRA_BP",category:"abnormality",description:"Fragile site must have exactly 1 breakpoint",validate:(r,t)=>mt(r,t)},Mt={id:"ABN_INS_BP",category:"abnormality",description:"Insertion must have exactly 3 breakpoints",validate:(r,t)=>ut(r,t)},Lt={id:"ABN_DMIN_BP",category:"abnormality",description:"Double minutes must have no breakpoints",validate:(r,t)=>lt(r,t)},Kt={id:"ABN_HSR_BP",category:"abnormality",description:"HSR must have 0 or 1 breakpoint",validate:(r,t)=>ht(r,t)},Dt={id:"ABN_MAR_BP",category:"abnormality",description:"Marker chromosome must have no breakpoints",validate:(r,t)=>dt(r,t)},qt={id:"ABN_PSU_DIC_BP",category:"abnormality",description:"Pseudodicentric breakpoint count must match chromosome count",validate:(r,t)=>yt(r,t)},Xt={id:"ABN_ACE_BP",category:"abnormality",description:"Acentric fragment must have 1-2 breakpoints",validate:(r,t)=>ft(r,t)},Yt={id:"ABN_TAS_BP",category:"abnormality",description:"Telomeric association breakpoint count must match chromosome count",validate:(r,t)=>bt(r,t)},Ut={id:"ABN_FIS_BP",category:"abnormality",description:"Fission must have exactly 1 breakpoint",validate:(r,t)=>At(r,t)},Ht={id:"ABN_NEO_BP",category:"abnormality",description:"Neocentromere must have exactly 1 breakpoint",validate:(r,t)=>Tt(r,t)},Wt={id:"ABN_INC_BP",category:"abnormality",description:"Incomplete karyotype marker must have no breakpoints",validate:(r,t)=>Rt(r,t)},b=[_t,kt,gt,Nt,vt,Et,It,\$t,Bt,St,wt,Ct,Pt,Ot,xt,Mt,Lt,Kt,Dt,qt,Xt,Yt,Ut,Ht,Wt];var Vt=new d,I=new y;I.addRules(f);I.addAbnormalityRules(b);function P(r){try{let t=Vt.parse(r);return I.validate(t)}catch(t){return t instanceof p?{valid:!1,errors:[t.message],parsed:null}:{valid:!1,errors:[t instanceof Error?t.message:String(t)],parsed:null}}}function Ft(r){return P(r).valid}var O={signatures:{"47,XX,+21":{summary:"Trisomy 21 (Down syndrome), female.",detail:"The presence of an extra chromosome 21 is diagnostic of Down syndrome. This is the most common chromosomal abnormality in live-born infants.",citation:{section:"12.1",page:150},refs:{omim:["190685"]},confidence:"curated"},"47,XY,+21":{summary:"Trisomy 21 (Down syndrome), male.",detail:"The presence of an extra chromosome 21 is diagnostic of Down syndrome. This is the most common chromosomal abnormality in live-born infants.",citation:{section:"12.1",page:150},refs:{omim:["190685"]},confidence:"curated"},"45,X":{summary:"Turner syndrome.",detail:"Monosomy X is associated with Turner syndrome. Clinical features often include short stature, ovarian dysgenesis, and lymphatic obstruction.",citation:{section:"12.2",page:155},refs:{omim:["300082"]},confidence:"curated"},"47,XXY":{summary:"Klinefelter syndrome.",detail:"The 47,XXY karyotype is the most common genetic cause of male hypogonadism and infertility.",citation:{section:"12.2",page:158},refs:{omim:["400045"]},confidence:"curated"},"t(9;22)(q34;q11.2)":{summary:"Philadelphia chromosome, t(9;22).",detail:"The reciprocal translocation between chromosomes 9 and 22 results in the BCR-ABL1 fusion gene, characteristic of Chronic Myeloid Leukemia (CML).",citation:{section:"15.3.1",page:210},refs:{omim:["608280","151410"]},confidence:"curated"},"del(5)(p15)":{summary:"Cri-du-chat syndrome.",detail:"Deletion of the terminal part of the short arm of chromosome 5 (5p-) is associated with Cri-du-chat syndrome.",citation:{section:"13.4",page:180},refs:{omim:["123450"]},confidence:"curated"}}};var Gt=O;function A(r){if(L(r)){let t=\`\${r.type}(\${r.chromosome})\`;if(r.breakpoints.length>0){let e=r.breakpoints.map(n=>{let s=n.arm+(n.region??"")+(n.band??"");return n.subband&&(s+="."+n.subband),s}),o=r.chromosome.includes(";")?";":"";t=\`\${r.type}(\${r.chromosome})(\${e.join(o)})\`}else(r.type==="+"||r.type==="-")&&(t=\`\${r.type}\${r.chromosome}\`);return t}else{let t=\`\${r.chromosome_count},\${r.sex_chromosomes}\`;if(r.abnormalities.length>0){let e=r.abnormalities.map(o=>A(o)).sort();t+=\`,\${e.join(",")}\`}return t}}function M(r){let t=Gt.signatures,e=A(r);if(t[e])return x(t[e]);if(L(r)&&r.breakpoints.length>0){let o=\`\${r.type}(\${r.chromosome})\`;if(t[o])return x(t[o])}return null}function x(r){return{summary:r.summary,detail:r.detail,citation:r.citation||null,refs:r.refs||{},confidence:"curated"}}function L(r){return r.type!==void 0&&r.chromosome!==void 0}function Qt(r){return r.type!==void 0&&r.chromosome!==void 0}function zt(r){return r.sex_chromosomes!==void 0}function Jt(r){return r.breakpoints.length===0?"":\` at \${r.breakpoints.map(e=>{let o=e.arm+(e.region??"")+(e.band??"");return e.subband&&(o+="."+e.subband),o}).join(", ")}\`}var Zt={"+":"Gain","-":"Loss",del:"Deletion",dup:"Duplication",inv:"Inversion",t:"Translocation",i:"Isochromosome",r:"Ring chromosome",ins:"Insertion",add:"Additional material",trp:"Triplication",dic:"Dicentric chromosome",idic:"Isodicentric chromosome",fra:"Fragile site",rob:"Robertsonian translocation",mar:"Marker chromosome"};function K(r){let t="",e="";if(Qt(r)){let o=Zt[r.type]||r.type,n=Jt(r);if(r.type==="+"||r.type==="-"?(t=\`\${o} of chromosome \${r.chromosome}.\`,e=\`The karyotype indicates a \${o.toLowerCase()} of an entire chromosome \${r.chromosome}.\`):r.type==="mar"?(t="Marker chromosome.",e="An unidentified extra structurally abnormal chromosome (ESAC) is present."):(t=\`\${o} on chromosome \${r.chromosome}\${n}.\`,e=\`A \${o.toLowerCase()} was identified on chromosome \${r.chromosome}\${n}.\`),r.inheritance){let a={mat:"maternally inherited",pat:"paternally inherited",dn:"de novo (not inherited)"}[r.inheritance]||\`inherited (\${r.inheritance})\`;t+=\` (\${r.inheritance})\`,e+=\` This abnormality is \${a}.\`}}else if(zt(r)){let o=r.chromosome_count,n=r.sex_chromosomes,s=r.abnormalities.length;t=\`\${o},\${n} karyotype with \${s} abnormalities.\`,e=\`This is a \${n} karyotype with a total chromosome count of \${o}. \`,s===0?e+="No structural or numerical abnormalities were detected.":e+=\`There are \${s} abnormality/abnormalities described.\`}return{summary:t,detail:e,citation:null,refs:{},confidence:"template"}}function te(r,t){let e=M(r);return e||(t?.onMiss&&t.onMiss(A(r)),K(r))}export{b as ALL_ABNORMALITY_RULES,f as ALL_CHROMOSOME_RULES,d as KaryotypeParser,p as ParseError,y as RuleEngine,te as explain,Ft as isValidKaryotypeNative,P as validateKaryotypeNative};
//# sourceMappingURL=iscn-core.js.map
`
};

// Embedded OpenAPI 3.1 spec for Deno Deploy parity with local dev.
// Regenerate with: deno run --allow-read --allow-write deno/scripts/embed-openapi.ts
// Drift detection: deno/tests/openapi_test.ts asserts this matches docs/openapi.yaml.
// BEGIN_EMBEDDED_OPENAPI_YAML
const OPENAPI_YAML: string = "openapi: 3.1.0\ninfo:\n  title: ISCN Authenticator API\n  version: 0.2.0\n  summary: ISCN 2024 karyotype validation as a service.\n  description: |\n    Validates karyotype strings against the 2024 International System for\n    Human Cytogenomic Nomenclature (ISCN) and returns a structured AST\n    alongside any rule violations.\n\n    All requests are authenticated by API key (Bearer or `X-API-Key`)\n    except for `/health`, `/status`, `/openapi.json`, and `/docs`.\n\n    Errors share a common envelope:\n\n    ```json\n    { \"error\": \"rate_limited\", \"message\": \"...\", \"request_id\": \"...\" }\n    ```\n\n    See the `ApiError` schema and the `ErrorCode` enum for the full set.\n  license:\n    name: MIT\n    identifier: MIT\n  contact:\n    name: ISCN Authenticator\n    url: https://github.com/nuin/iscn-authenticator\n    email: nuin@genedrift.org\n\nservers:\n  - url: https://iscn.bioinformat.com\n    description: Reference deployment\n  - url: http://localhost:8000\n    description: Local dev\n\nsecurity:\n  - BearerAuth: []\n  - ApiKeyAuth: []\n\ntags:\n  - name: validation\n    description: ISCN karyotype validation.\n  - name: account\n    description: Customer-facing account endpoints (usage, key management).\n  - name: meta\n    description: Liveness, status, spec discovery.\n  - name: billing\n    description: Stripe webhook ingest. Not for direct customer use.\n\npaths:\n  /health:\n    get:\n      tags: [meta]\n      summary: Liveness probe\n      description: Cheap liveness check; does not touch KV.\n      security: []\n      responses:\n        \"200\":\n          description: Service is live.\n          content:\n            application/json:\n              schema:\n                type: object\n                required: [ok]\n                properties:\n                  ok:\n                    type: boolean\n                    const: true\n\n  /openapi.json:\n    get:\n      tags: [meta]\n      summary: OpenAPI 3.1 specification (JSON)\n      description: |\n        The full OpenAPI 3.1 spec for this API as JSON. The canonical source\n        is `docs/openapi.yaml` in the repository; this endpoint serves the\n        same document parsed to JSON.\n      security: []\n      responses:\n        \"200\":\n          description: OpenAPI document.\n          content:\n            application/json:\n              schema:\n                type: object\n\n  /validate:\n    get:\n      tags: [validation]\n      summary: Validate a karyotype string (query parameter)\n      parameters:\n        - name: karyotype\n          in: query\n          required: true\n          schema:\n            $ref: \"#/components/schemas/KaryotypeString\"\n      responses:\n        \"200\":\n          description: Validation result.\n          headers:\n            X-RateLimit-Limit: { $ref: \"#/components/headers/X-RateLimit-Limit\" }\n            X-RateLimit-Remaining: { $ref: \"#/components/headers/X-RateLimit-Remaining\" }\n            X-RateLimit-Reset: { $ref: \"#/components/headers/X-RateLimit-Reset\" }\n            X-Monthly-Quota-Limit: { $ref: \"#/components/headers/X-Monthly-Quota-Limit\" }\n            X-Monthly-Quota-Remaining: { $ref: \"#/components/headers/X-Monthly-Quota-Remaining\" }\n            X-Monthly-Quota-Reset: { $ref: \"#/components/headers/X-Monthly-Quota-Reset\" }\n          content:\n            application/json:\n              schema:\n                $ref: \"#/components/schemas/ValidationResult\"\n        \"400\":\n          $ref: \"#/components/responses/InvalidRequest\"\n        \"401\":\n          $ref: \"#/components/responses/Unauthenticated\"\n        \"402\":\n          $ref: \"#/components/responses/QuotaExceeded\"\n        \"405\":\n          $ref: \"#/components/responses/MethodNotAllowed\"\n        \"429\":\n          $ref: \"#/components/responses/RateLimited\"\n        \"500\":\n          $ref: \"#/components/responses/Internal\"\n    post:\n      tags: [validation]\n      summary: Validate a karyotype string (JSON body)\n      requestBody:\n        required: true\n        content:\n          application/json:\n            schema:\n              type: object\n              required: [karyotype]\n              properties:\n                karyotype:\n                  $ref: \"#/components/schemas/KaryotypeString\"\n      responses:\n        \"200\":\n          description: Validation result.\n          headers:\n            X-RateLimit-Limit: { $ref: \"#/components/headers/X-RateLimit-Limit\" }\n            X-RateLimit-Remaining: { $ref: \"#/components/headers/X-RateLimit-Remaining\" }\n            X-RateLimit-Reset: { $ref: \"#/components/headers/X-RateLimit-Reset\" }\n            X-Monthly-Quota-Limit: { $ref: \"#/components/headers/X-Monthly-Quota-Limit\" }\n            X-Monthly-Quota-Remaining: { $ref: \"#/components/headers/X-Monthly-Quota-Remaining\" }\n            X-Monthly-Quota-Reset: { $ref: \"#/components/headers/X-Monthly-Quota-Reset\" }\n          content:\n            application/json:\n              schema:\n                $ref: \"#/components/schemas/ValidationResult\"\n        \"400\":\n          $ref: \"#/components/responses/InvalidRequest\"\n        \"401\":\n          $ref: \"#/components/responses/Unauthenticated\"\n        \"402\":\n          $ref: \"#/components/responses/QuotaExceeded\"\n        \"405\":\n          $ref: \"#/components/responses/MethodNotAllowed\"\n        \"413\":\n          $ref: \"#/components/responses/BodyTooLarge\"\n        \"429\":\n          $ref: \"#/components/responses/RateLimited\"\n        \"500\":\n          $ref: \"#/components/responses/Internal\"\n\n  /usage:\n    get:\n      tags: [account]\n      summary: Monthly usage snapshot\n      description: |\n        Returns the current month's request count and quota for the\n        authenticated customer. Read-only; does not bump the counter.\n\n        Grandfathered keys (no associated customer) return `404`.\n      responses:\n        \"200\":\n          description: Usage snapshot.\n          headers:\n            X-Monthly-Quota-Limit: { $ref: \"#/components/headers/X-Monthly-Quota-Limit\" }\n            X-Monthly-Quota-Remaining: { $ref: \"#/components/headers/X-Monthly-Quota-Remaining\" }\n            X-Monthly-Quota-Reset: { $ref: \"#/components/headers/X-Monthly-Quota-Reset\" }\n          content:\n            application/json:\n              schema:\n                $ref: \"#/components/schemas/UsageSnapshot\"\n        \"401\":\n          $ref: \"#/components/responses/Unauthenticated\"\n        \"404\":\n          $ref: \"#/components/responses/NotFound\"\n        \"405\":\n          $ref: \"#/components/responses/MethodNotAllowed\"\n        \"500\":\n          $ref: \"#/components/responses/Internal\"\n\n  /keys/rotate:\n    post:\n      tags: [account]\n      summary: Rotate the calling API key\n      description: |\n        Issues a new API key with the same label/customer/environment as\n        the calling key, then immediately revokes the calling key. There is\n        no grace window — the next request must use the new key.\n\n        The plaintext is shown only in this response. Store it before the\n        connection closes.\n      responses:\n        \"200\":\n          description: New key issued. Old key is revoked.\n          content:\n            application/json:\n              schema:\n                $ref: \"#/components/schemas/RotateKeyResult\"\n        \"401\":\n          $ref: \"#/components/responses/Unauthenticated\"\n        \"405\":\n          $ref: \"#/components/responses/MethodNotAllowed\"\n        \"500\":\n          $ref: \"#/components/responses/Internal\"\n\n  /billing/webhook:\n    post:\n      tags: [billing]\n      summary: Stripe webhook ingest\n      description: |\n        Stripe-only endpoint. Validates the `Stripe-Signature` header against\n        `STRIPE_WEBHOOK_SECRET` and dispatches the event to the billing\n        handlers. Idempotent on `event.id` for 7 days. The body is empty\n        on success — Stripe checks status code only.\n      security:\n        - StripeSignature: []\n      requestBody:\n        required: true\n        content:\n          application/json:\n            schema:\n              type: object\n              description: Stripe Event payload (see Stripe API docs).\n      parameters:\n        - name: Stripe-Signature\n          in: header\n          required: true\n          schema:\n            type: string\n      responses:\n        \"200\":\n          description: Event accepted (or already processed).\n        \"400\":\n          description: Signature or payload rejected.\n          content:\n            application/json:\n              schema:\n                $ref: \"#/components/schemas/ApiError\"\n        \"405\":\n          $ref: \"#/components/responses/MethodNotAllowed\"\n        \"500\":\n          $ref: \"#/components/responses/Internal\"\n\ncomponents:\n  securitySchemes:\n    BearerAuth:\n      type: http\n      scheme: bearer\n      bearerFormat: opaque\n      description: |\n        `Authorization: Bearer iscn_live_...` — the value returned by\n        `/signup` or by `keys:create` in the admin CLI.\n    ApiKeyAuth:\n      type: apiKey\n      in: header\n      name: X-API-Key\n      description: |\n        Alternative to `Authorization: Bearer`. Either header alone is\n        sufficient. Sending both is allowed but redundant.\n    StripeSignature:\n      type: apiKey\n      in: header\n      name: Stripe-Signature\n      description: |\n        Stripe webhook signature header. Validated against\n        `STRIPE_WEBHOOK_SECRET` server-side; not for general use.\n\n  headers:\n    X-RateLimit-Limit:\n      description: Token-bucket capacity (max burst).\n      schema: { type: integer, minimum: 1 }\n    X-RateLimit-Remaining:\n      description: Tokens remaining in the bucket after this request.\n      schema: { type: integer, minimum: 0 }\n    X-RateLimit-Reset:\n      description: Unix seconds at which the bucket would be fully refilled.\n      schema: { type: integer, minimum: 0 }\n    X-Monthly-Quota-Limit:\n      description: Monthly request quota for the customer's tier.\n      schema: { type: integer, minimum: 0 }\n    X-Monthly-Quota-Remaining:\n      description: Requests remaining in the current calendar month (UTC).\n      schema: { type: integer, minimum: 0 }\n    X-Monthly-Quota-Reset:\n      description: Unix seconds at the start of the next UTC month.\n      schema: { type: integer, minimum: 0 }\n    Retry-After:\n      description: Seconds the client should wait before retrying.\n      schema: { type: integer, minimum: 1 }\n    WWW-Authenticate:\n      description: Authentication challenge for 401 responses.\n      schema: { type: string }\n\n  schemas:\n    KaryotypeString:\n      type: string\n      description: |\n        ISCN 2024 karyotype, e.g. `46,XX`, `47,XY,+21`, `46,XX,t(9;22)(q34;q11.2)`.\n      minLength: 1\n      maxLength: 4096\n      examples:\n        - \"46,XX\"\n        - \"47,XY,+21\"\n        - \"46,XX,del(5)(q13q33)\"\n        - \"46,XX,t(9;22)(q34;q11.2)\"\n        - \"47,XY,+21[8]/46,XY[12]\"\n\n    ErrorCode:\n      type: string\n      enum:\n        - unauthenticated\n        - rate_limited\n        - quota_exceeded\n        - body_too_large\n        - invalid_request\n        - invalid_signup\n        - not_found\n        - method_not_allowed\n        - stripe_error\n        - internal\n\n    ApiError:\n      type: object\n      required: [error, message, request_id]\n      properties:\n        error: { $ref: \"#/components/schemas/ErrorCode\" }\n        message:\n          type: string\n          description: Human-readable detail (never includes a stack trace).\n        request_id:\n          type: string\n          description: Server-assigned ID for log correlation.\n\n    Breakpoint:\n      type: object\n      required: [arm, region, band, subband, uncertain]\n      properties:\n        arm: { type: string, description: \"p, q, cen, ter\" }\n        region: { type: [integer, \"null\"] }\n        band: { type: [integer, \"null\"] }\n        subband: { type: [string, \"null\"] }\n        uncertain: { type: boolean }\n\n    Abnormality:\n      type: object\n      required: [type, chromosome, breakpoints, inheritance, uncertain, copy_count, raw]\n      properties:\n        type:\n          type: string\n          description: \"Operator: +, -, del, dup, inv, t, ins, i, idic, der, dic, r, rob, trp, mar, ...\"\n        chromosome:\n          type: string\n          description: Chromosome identifier; multi-chr events use `;` separators.\n        breakpoints:\n          type: array\n          items: { $ref: \"#/components/schemas/Breakpoint\" }\n        inheritance:\n          type: [string, \"null\"]\n          enum: [mat, pat, dn, null]\n        uncertain: { type: boolean }\n        copy_count: { type: [integer, \"null\"] }\n        raw: { type: string }\n        explanation: { $ref: \"#/components/schemas/ExplainResult\" }\n\n    Modifiers:\n      type: object\n      properties:\n        mosaic: { type: boolean }\n        chimera: { type: boolean }\n        constitutional: { type: boolean }\n        incomplete: { type: boolean }\n        ish: { type: string }\n        arr: { type: string }\n        ogm: { type: string }\n        composite: { type: integer }\n        stemline: { type: boolean }\n        sideline: { type: boolean }\n        interphase: { type: boolean }\n\n    CellLine:\n      type: object\n      required: [chromosome_count, sex_chromosomes, abnormalities, count, is_donor]\n      properties:\n        chromosome_count: { type: integer }\n        sex_chromosomes: { type: string }\n        abnormalities:\n          type: array\n          items: { $ref: \"#/components/schemas/Abnormality\" }\n        count: { type: integer }\n        is_donor: { type: boolean }\n\n    KaryotypeAST:\n      type: object\n      required: [chromosome_count, sex_chromosomes, abnormalities, cell_lines, modifiers]\n      properties:\n        chromosome_count:\n          oneOf:\n            - { type: integer }\n            - { type: string, description: \"Range like '45~48'\" }\n            - { type: \"null\" }\n        sex_chromosomes:\n          type: string\n          description: \"Sex chromosome string (e.g. XX, XY, X, XXY, U for undisclosed).\"\n        abnormalities:\n          type: array\n          items: { $ref: \"#/components/schemas/Abnormality\" }\n        cell_lines:\n          oneOf:\n            - { type: array, items: { $ref: \"#/components/schemas/CellLine\" } }\n            - { type: \"null\" }\n        modifiers:\n          oneOf:\n            - { $ref: \"#/components/schemas/Modifiers\" }\n            - { type: \"null\" }\n\n    ExplainResult:\n      type: object\n      required: [summary, detail, citation, refs, confidence]\n      properties:\n        summary: { type: string }\n        detail: { type: string }\n        citation:\n          oneOf:\n            - type: object\n              required: [section]\n              properties:\n                section: { type: string }\n                page: { type: integer }\n            - { type: \"null\" }\n        refs:\n          type: object\n          properties:\n            omim: { type: array, items: { type: string } }\n            hpo: { type: array, items: { type: string } }\n            clinvar: { type: array, items: { type: string } }\n        confidence:\n          type: string\n          enum: [template, curated, none]\n\n    ValidationResult:\n      type: object\n      required: [valid, errors, parsed]\n      properties:\n        valid: { type: boolean }\n        errors:\n          type: array\n          items: { type: string }\n        parsed:\n          oneOf:\n            - { $ref: \"#/components/schemas/KaryotypeAST\" }\n            - { type: \"null\" }\n        explanation: { $ref: \"#/components/schemas/ExplainResult\" }\n\n    UsageSnapshot:\n      type: object\n      required: [customer_id, tier, month, used, limit, remaining, reset_at]\n      properties:\n        customer_id:\n          type: string\n          description: Stable customer identifier (`c_<hex>`).\n        tier:\n          type: string\n          enum: [free, pro]\n        month:\n          type: string\n          pattern: \"^\\\\d{4}-\\\\d{2}$\"\n          description: Calendar month in `YYYY-MM` (UTC).\n        used: { type: integer, minimum: 0 }\n        limit: { type: integer, minimum: 0 }\n        remaining: { type: integer, minimum: 0 }\n        reset_at:\n          type: integer\n          minimum: 0\n          description: Unix seconds at the start of the next UTC month.\n\n    RotateKeyResult:\n      type: object\n      required: [old_key_id, new_key, new_key_id]\n      properties:\n        old_key_id: { type: string }\n        new_key:\n          type: string\n          description: New API key plaintext. Store now — never returned again.\n        new_key_id: { type: string }\n\n  responses:\n    InvalidRequest:\n      description: Malformed request.\n      content:\n        application/json:\n          schema: { $ref: \"#/components/schemas/ApiError\" }\n    Unauthenticated:\n      description: Missing or invalid API key.\n      headers:\n        WWW-Authenticate: { $ref: \"#/components/headers/WWW-Authenticate\" }\n      content:\n        application/json:\n          schema: { $ref: \"#/components/schemas/ApiError\" }\n    QuotaExceeded:\n      description: Monthly request quota exceeded — upgrade plan to continue.\n      headers:\n        X-Monthly-Quota-Limit: { $ref: \"#/components/headers/X-Monthly-Quota-Limit\" }\n        X-Monthly-Quota-Remaining: { $ref: \"#/components/headers/X-Monthly-Quota-Remaining\" }\n        X-Monthly-Quota-Reset: { $ref: \"#/components/headers/X-Monthly-Quota-Reset\" }\n      content:\n        application/json:\n          schema: { $ref: \"#/components/schemas/ApiError\" }\n    NotFound:\n      description: Resource not found.\n      content:\n        application/json:\n          schema: { $ref: \"#/components/schemas/ApiError\" }\n    MethodNotAllowed:\n      description: Wrong HTTP verb for this route.\n      headers:\n        Allow:\n          schema: { type: string }\n          description: Comma-separated list of allowed methods.\n      content:\n        application/json:\n          schema: { $ref: \"#/components/schemas/ApiError\" }\n    BodyTooLarge:\n      description: Request body exceeds the configured limit.\n      content:\n        application/json:\n          schema: { $ref: \"#/components/schemas/ApiError\" }\n    RateLimited:\n      description: Token-bucket exhausted; retry after the indicated interval.\n      headers:\n        Retry-After: { $ref: \"#/components/headers/Retry-After\" }\n        X-RateLimit-Limit: { $ref: \"#/components/headers/X-RateLimit-Limit\" }\n        X-RateLimit-Remaining: { $ref: \"#/components/headers/X-RateLimit-Remaining\" }\n        X-RateLimit-Reset: { $ref: \"#/components/headers/X-RateLimit-Reset\" }\n      content:\n        application/json:\n          schema: { $ref: \"#/components/schemas/ApiError\" }\n    Internal:\n      description: Unhandled server error. The `request_id` is logged.\n      content:\n        application/json:\n          schema: { $ref: \"#/components/schemas/ApiError\" }\n";
// END_EMBEDDED_OPENAPI_YAML

const handler = buildHandler({
  kv,
  config,
  staticHtml: INDEX_HTML,
  staticAssets,
  openapiYaml: OPENAPI_YAML,
  logSink,
});

Deno.serve(handler);
