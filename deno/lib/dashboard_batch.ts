/** Browser-side batch validation interface for Pro accounts. */
export function renderBatchBody(): string {
  return `
    <h2>Batch Validation</h2>
    <p class="muted" style="margin-bottom: 1.5rem;">Enter one karyotype per line (up to 500). Processing is done entirely in your browser.</p>

    <div style="margin-bottom: 1.5rem;">
      <textarea id="batch-input" style="width: 100%; height: 200px; font-family: var(--font-mono); padding: 0.75rem; border: 2px solid var(--color-border); border-radius: var(--radius); resize: vertical; outline: none; transition: border-color 0.2s;" placeholder="46,XX\n47,XY,+21\n..."></textarea>
    </div>

    <div style="display: flex; gap: 0.5rem; margin-bottom: 2rem; flex-wrap: wrap;">
      <button id="batch-run" class="btn btn-primary">Run Batch</button>
      <button id="batch-clear" class="btn">Clear</button>
      <div style="flex: 1; min-width: 1rem;"></div>
      <button id="batch-export-csv" class="btn" disabled>Export CSV</button>
      <button id="batch-export-json" class="btn" disabled>Export JSON</button>
    </div>

    <div id="batch-results-container" class="hidden" style="margin-top: 2rem;">
      <h3 style="font-size: 1rem; margin-bottom: 1rem;">Results (<span id="batch-count">0</span>)</h3>
      <div style="overflow-x: auto;">
        <table id="batch-table">
          <thead>
            <tr>
              <th style="width: 30%;">Karyotype</th>
              <th style="width: 15%;">Status</th>
              <th>Explanation / Errors</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

    <script type="module">
      import { validateKaryotypeNative, explain } from "/static/iscn-core.js";

      const input = document.getElementById('batch-input');
      const runBtn = document.getElementById('batch-run');
      const clearBtn = document.getElementById('batch-clear');
      const csvBtn = document.getElementById('batch-export-csv');
      const jsonBtn = document.getElementById('batch-export-json');
      const resultsContainer = document.getElementById('batch-results-container');
      const tbody = document.querySelector('#batch-table tbody');
      const countSpan = document.getElementById('batch-count');

      let currentResults = [];

      runBtn.onclick = () => {
        const lines = input.value.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) return;
        if (lines.length > 500) {
          alert('Maximum 500 lines allowed.');
          return;
        }

        runBtn.disabled = true;
        runBtn.textContent = 'Processing...';
        tbody.innerHTML = '';
        currentResults = [];

        lines.forEach(k => {
          try {
            const result = validateKaryotypeNative(k);
            let explanation = '—';
            if (result.parsed) {
              const exp = explain(result.parsed);
              explanation = exp.summary;
            } else if (result.errors.length > 0) {
              explanation = result.errors.join('; ');
            }

            const row = { karyotype: k, valid: result.valid, explanation };
            currentResults.push(row);

            const tr = document.createElement('tr');
            tr.innerHTML = \`
              <td class="mono" style="word-break: break-all;">\${esc(k)}</td>
              <td><span class="tag \${row.valid ? 'pro' : 'revoked'}">\${row.valid ? 'VALID' : 'INVALID'}</span></td>
              <td style="font-size: 0.75rem; color: var(--color-text-muted);">\${esc(explanation)}</td>
            \`;
            tbody.appendChild(tr);
          } catch (err) {
            console.error(err);
          }
        });

        countSpan.textContent = currentResults.length;
        resultsContainer.classList.remove('hidden');
        csvBtn.disabled = false;
        jsonBtn.disabled = false;
        runBtn.disabled = false;
        runBtn.textContent = 'Run Batch';
      };

      clearBtn.onclick = () => {
        input.value = '';
        tbody.innerHTML = '';
        resultsContainer.classList.add('hidden');
        csvBtn.disabled = true;
        jsonBtn.disabled = true;
        currentResults = [];
      };

      csvBtn.onclick = () => {
        const headers = ['Karyotype', 'Valid', 'Explanation/Errors'];
        const csv = [
          headers.join(','),
          ...currentResults.map(r => [
            '"' + r.karyotype.replace(/"/g, '""') + '"',
            r.valid ? 'true' : 'false',
            '"' + r.explanation.replace(/"/g, '""') + '"'
          ].join(','))
        ].join('\\n');
        download(csv, 'iscn-batch-results.csv', 'text/csv');
      };

      jsonBtn.onclick = () => {
        download(JSON.stringify(currentResults, null, 2), 'iscn-batch-results.json', 'application/json');
      };

      function download(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }

      function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    </script>
    <style>
      .hidden { display: none; }
      #batch-input:focus { border-color: var(--color-primary); }
    </style>
  `;
}
