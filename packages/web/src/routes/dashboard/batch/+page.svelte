<script lang="ts">
	import { validateKaryotypeNative, explain } from '@iscn/core';

	let input = $state('');
	let results = $state<any[]>([]);
	let isProcessing = $state(false);

	function runBatch() {
		const lines = input
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l.length > 0);
		if (lines.length === 0) return;
		if (lines.length > 500) {
			alert('Maximum 500 lines allowed.');
			return;
		}

		isProcessing = true;
		results = [];

		lines.forEach((k) => {
			try {
				const res = validateKaryotypeNative(k);
				let explanation = '—';
				if (res.parsed) {
					const exp = explain(res.parsed);
					explanation = exp.summary;
				} else if (res.errors.length > 0) {
					explanation = res.errors.join('; ');
				}
				results.push({ karyotype: k, valid: res.valid, explanation });
			} catch (err) {
				console.error(err);
			}
		});

		isProcessing = false;
	}

	function clear() {
		input = '';
		results = [];
	}

	function exportCSV() {
		const headers = ['Karyotype', 'Valid', 'Explanation/Errors'];
		const csv = [
			headers.join(','),
			...results.map((r) =>
				[
					'"' + r.karyotype.replace(/"/g, '""') + '"',
					r.valid ? 'true' : 'false',
					'"' + r.explanation.replace(/"/g, '""') + '"'
				].join(',')
			)
		].join('\n');
		download(csv, 'iscn-batch-results.csv', 'text/csv');
	}

	function exportJSON() {
		download(JSON.stringify(results, null, 2), 'iscn-batch-results.json', 'application/json');
	}

	function download(content: string, filename: string, contentType: string) {
		const blob = new Blob([content], { type: contentType });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<h2>Batch Validation</h2>
<p class="muted">
	Enter one karyotype per line (up to 500). Processing is done entirely in your browser.
</p>

<div class="input-area">
	<textarea
		bind:value={input}
		placeholder="46,XX\n47,XY,+21\n..."
		spellcheck="false"
		autocomplete="off"
	></textarea>
</div>

<div class="actions">
	<button class="btn btn-primary" onclick={runBatch} disabled={isProcessing}>
		{isProcessing ? 'Processing...' : 'Run Batch'}
	</button>
	<button class="btn btn-outline" onclick={clear}>Clear</button>
	<div class="spacer"></div>
	<button class="btn" onclick={exportCSV} disabled={results.length === 0}>Export CSV</button>
	<button class="btn" onclick={exportJSON} disabled={results.length === 0}>Export JSON</button>
</div>

{#if results.length > 0}
	<div class="results-container">
		<h3>Results ({results.length})</h3>
		<div class="table-scroll">
			<table>
				<thead>
					<tr>
						<th>Karyotype</th>
						<th>Status</th>
						<th>Explanation / Errors</th>
					</tr>
				</thead>
				<tbody>
					{#each results as row}
						<tr>
							<td class="mono">{row.karyotype}</td>
							<td>
								<span class="tag {row.valid ? 'valid' : 'invalid'}">
									{row.valid ? 'VALID' : 'INVALID'}
								</span>
							</td>
							<td class="explanation">{row.explanation}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}

<style>
	.muted {
		color: var(--color-text-muted);
		font-size: 0.9rem;
		margin-bottom: 1.5rem;
	}

	.input-area textarea {
		width: 100%;
		height: 200px;
		font-family: var(--font-mono);
		padding: 1rem;
		border: 2px solid var(--color-border);
		border-radius: var(--radius);
		resize: vertical;
		outline: none;
		box-sizing: border-box;
	}

	.input-area textarea:focus {
		border-color: var(--color-primary);
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
		flex-wrap: wrap;
	}

	.btn {
		padding: 0.6rem 1.2rem;
		border-radius: 6px;
		font-weight: 500;
		cursor: pointer;
		border: 1px solid var(--color-border);
		background: white;
	}

	.btn-primary {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}

	.btn-outline {
		color: var(--color-primary);
		border-color: var(--color-primary);
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.spacer {
		flex: 1;
		min-width: 1rem;
	}

	.results-container {
		margin-top: 3rem;
	}

	.table-scroll {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		text-align: left;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	th {
		background: var(--color-bg);
		font-size: 0.8rem;
		text-transform: uppercase;
		color: var(--color-text-muted);
	}

	.mono {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		word-break: break-all;
	}

	.tag {
		font-size: 0.7rem;
		font-weight: bold;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
	}

	.tag.valid {
		background: #d1e7dd;
		color: #0f5132;
	}

	.tag.invalid {
		background: #f8d7da;
		color: #842029;
	}

	.explanation {
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}
</style>
