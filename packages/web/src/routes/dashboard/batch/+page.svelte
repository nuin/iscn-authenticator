<script lang="ts">
	import { batchCSV, downloadValidationFile, reviewBatch, type BatchRow, type ReviewStatus } from '#lib/validation.ts';

	let input = $state('');
	let results = $state<BatchRow[]>([]);
	let inputError = $state('');
	let filter = $state<ReviewStatus | 'All results'>('All results');
	const filters = ['All results', 'Checks passed', 'Issues found', 'Review required'] as const;
	const lineCount = $derived(input.split(/\r?\n/).filter((line) => line.trim()).length);
	const visibleRows = $derived(filter === 'All results' ? results : results.filter((row) => row.status === filter));
	const totals = $derived({
		passed: results.filter((row) => row.status === 'Checks passed').length,
		issues: results.filter((row) => row.status === 'Issues found').length,
		review: results.filter((row) => row.status === 'Review required').length
	});

	function runBatch() {
		const batch = reviewBatch(input);
		results = batch.rows;
		inputError = batch.error ?? '';
		filter = 'All results';
	}

	function resetResults() {
		results = [];
		inputError = '';
	}

	function loadExample() {
		input = '46,XX\n47,XY,+21\n46,XX,del(5)(p13q33)\n46,XX[10]/47,XX,+21[5]';
		resetResults();
	}

	function exportJSON() {
		downloadValidationFile(JSON.stringify(results, null, 2), 'iscn-batch-results.json', 'application/json');
	}
</script>

<svelte:head><title>Batch review · ISCN Authenticator</title></svelte:head>

<header class="batch-heading">
	<p class="section-label">Browser workspace</p>
	<h1>Batch review</h1>
	<p>One karyotype per line. Keep each result, issue and coverage note together.</p>
</header>

<section class="batch-entry" aria-labelledby="batch-input-heading">
	<div class="entry-title"><h2 id="batch-input-heading">Karyotypes to review</h2><span class:over-limit={lineCount > 500}>{lineCount} / 500 entries</span></div>
	<form onsubmit={(event) => { event.preventDefault(); runBatch(); }}>
		<label for="batch-input">ISCN notation, one entry per line</label>
		<textarea id="batch-input" bind:value={input} oninput={resetResults} placeholder="46,XX&#10;47,XY,+21&#10;46,XX,t(9;22)(q34;q11.2)" rows="8" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby={inputError ? 'batch-input-help batch-input-error' : 'batch-input-help'} aria-invalid={Boolean(inputError)}></textarea>
		<p id="batch-input-help" class="input-help">Blank lines are ignored. Original line numbers stay with each result. Paste notation only, without patient identifiers.</p>
		{#if inputError}<p id="batch-input-error" class="input-error" role="alert">{inputError}</p>{/if}
		<div class="entry-actions">
			<button type="submit" class="button">Check batch <span aria-hidden="true">→</span></button>
			<button type="button" class="button secondary" onclick={loadExample}>Load example batch</button>
			{#if input}<button type="button" class="button quiet" onclick={() => { input = ''; resetResults(); }}>Clear</button>{/if}
		</div>
	</form>
	<p class="local-note"><span aria-hidden="true">◉</span> Checks run in your browser. Entries and results are not sent to a validation server or saved by this workspace.</p>
</section>

<div class="batch-notice">
	<p><strong>Read the scope alongside the result.</strong> “Checks passed” means that implemented checks found no issues. Unsupported notation, assay extensions and multiple cell lines can need further review.</p>
	<a href="/docs/batch">Batch review guide →</a>
</div>

<div class="result-announcement" role="status">{results.length ? `${results.length} entries checked. ${totals.passed} checks passed, ${totals.issues} with issues, ${totals.review} require review.` : ''}</div>

{#if results.length}
	<section class="batch-results" aria-labelledby="batch-results-heading">
		<div class="results-heading">
			<div><p class="section-label">Review results</p><h2 id="batch-results-heading">{results.length} entries checked</h2></div>
			<div class="export-actions">
				<button type="button" class="button secondary" onclick={() => downloadValidationFile(batchCSV(results), 'iscn-batch-results.csv', 'text/csv;charset=utf-8')}>Download CSV</button>
				<button type="button" class="button secondary" onclick={exportJSON}>Download JSON</button>
			</div>
		</div>
		<div class="summary-counts">
			<span class="passed"><strong>{totals.passed}</strong> Checks passed</span>
			<span class="issues"><strong>{totals.issues}</strong> Issues found</span>
			<span class="review"><strong>{totals.review}</strong> Review required</span>
		</div>
		<div class="filter-bar">
			<label for="result-filter">Show</label>
			<select id="result-filter" bind:value={filter}>{#each filters as option}<option>{option}</option>{/each}</select>
			<span>{visibleRows.length} of {results.length} entries</span>
		</div>
		{#if visibleRows.length}
			<div class="table-scroll" role="region" aria-label="Batch results table">
				<table>
					<thead><tr><th scope="col">Line</th><th scope="col">Karyotype</th><th scope="col">Status</th><th scope="col">Issues and coverage</th></tr></thead>
					<tbody>
						{#each visibleRows as row}
							<tr>
								<td class="line-number">{row.line}</td>
								<td class="notation"><code>{row.karyotype}</code></td>
								<td><span class="status" class:passed={row.status === 'Checks passed'} class:issues={row.status === 'Issues found'} class:review={row.status === 'Review required'}>{row.status}</span></td>
								<td class="row-details">
									{#if row.result.errors.length}<ul class="errors">{#each row.result.errors as error}<li>{error}</li>{/each}</ul>{/if}
									{#if row.coverage.length}<ul class="coverage">{#each row.coverage as note}<li>{note.message}</li>{/each}</ul>{/if}
									{#if !row.result.errors.length && !row.coverage.length}<span>No issues found by the implemented checks.</span>{/if}
								</td>
							</tr>
						{/each}
						</tbody>
					</table>
				</div>
		{:else}<p class="empty-filter">No entries have this status. Choose another filter to continue reviewing.</p>{/if}
		<p class="export-note">Downloads include all {results.length} entries, including entries hidden by the filter. JSON contains each unchanged core result alongside its review status and coverage notes. CSV protects cells that could be read as spreadsheet formulas.</p>
	</section>
{:else}
	<div class="batch-empty"><span aria-hidden="true">01 → 02 → 03</span><p>Paste a batch, review every row, then download your results.</p></div>
{/if}

<footer class="batch-footer">Results do not certify full ISCN compliance or provide a clinical interpretation. <a href="/docs/coverage">Coverage and limitations</a> · <a href="/docs/reading-results">Reading results</a></footer>

<style>
	.batch-heading { margin-bottom: 2rem; }
	.batch-heading h1 { font-size: clamp(1.8rem, 3vw, 2.5rem); letter-spacing: -.035em; margin: .5rem 0 .75rem; }
	.batch-heading > p:last-child { color: var(--color-text-muted); line-height: 1.7; max-width: 580px; }
	.batch-entry { border: 1px solid var(--color-border); border-radius: var(--radius); padding: 1.5rem; background: var(--color-surface); }
	.entry-title { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.2rem; }
	.entry-title h2 { margin: 0; font-size: 1rem; }
	.entry-title span { color: var(--color-text-muted); font: .75rem var(--font-mono); }
	.entry-title span.over-limit { color: #a93535; }
	form > label { display: block; font-size: .78rem; font-weight: 600; margin-bottom: .6rem; }
	textarea { width: 100%; box-sizing: border-box; min-height: 210px; padding: 1rem; resize: vertical; color: var(--color-text); background: #fbfdff; border: 1px solid #a6bccb; border-radius: 6px; font: .85rem/1.9 var(--font-mono); }
	textarea:focus-visible { outline: 3px solid #a4dbe5; outline-offset: 2px; }
	textarea[aria-invalid='true'] { border-color: #b84242; }
	.input-help { color: var(--color-text-muted); font-size: .75rem; line-height: 1.6; margin: .6rem 0 1.2rem; }
	.input-error { color: #a93535; font-size: .82rem; line-height: 1.6; }
	.entry-actions, .export-actions { display: flex; gap: .6rem; flex-wrap: wrap; }
	.entry-actions .button, .export-actions .button { font-size: .8rem; }
	.entry-actions .button:first-child { gap: 1.4rem; }
	.local-note { display: flex; gap: .6rem; font-size: .74rem; line-height: 1.6; color: var(--color-primary); margin: 1.2rem 0 0; padding-top: 1rem; border-top: 1px solid var(--color-border); }
	.batch-notice { padding: 1.25rem 0; border-bottom: 1px solid var(--color-border); font-size: .78rem; line-height: 1.7; color: var(--color-text-muted); }
	.batch-notice p { margin: 0 0 .4rem; }
	.batch-notice strong { color: var(--color-text); }
	.results-heading { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; margin-top: 2.5rem; }
	.results-heading h2 { font-size: 1.4rem; margin: .5rem 0 1rem; letter-spacing: -.025em; }
	.summary-counts { display: flex; gap: 1rem 2rem; flex-wrap: wrap; padding: 1.3rem 0; border-bottom: 1px solid var(--color-border); font-size: .78rem; }
	.summary-counts strong { font: 1.25rem var(--font-mono); margin-right: .4rem; }
	.passed { color: #26704f; } .issues { color: #a93535; } .review { color: #855b0b; }
	.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem; padding: 1.2rem 0; font-size: .78rem; }
	.filter-bar label { font-weight: 600; }
	.filter-bar span { color: var(--color-text-muted); margin-left: auto; }
	select { font: inherit; color: var(--color-text); background: var(--color-surface); padding: .5rem 1.5rem .5rem .65rem; border: 1px solid var(--color-border); border-radius: 5px; }
	.table-scroll { overflow-x: auto; border: 1px solid var(--color-border); border-radius: 8px; }
	table { border-collapse: collapse; width: 100%; min-width: 620px; table-layout: fixed; }
	th, td { text-align: left; padding: .9rem .8rem; vertical-align: top; border-bottom: 1px solid var(--color-border); }
	th { background: var(--color-bg); color: var(--color-text-muted); font-size: .72rem; font-weight: 600; }
	th:first-child { width: 45px; } th:nth-child(2) { width: 29%; } th:nth-child(3) { width: 115px; }
	tbody tr:last-child td { border-bottom: 0; }
	.line-number { font: .75rem var(--font-mono); color: var(--color-text-muted); }
	.notation { overflow-wrap: anywhere; } code { font: .76rem/1.65 var(--font-mono); }
	.status { display: inline-block; font-size: .7rem; font-weight: 600; padding: .2rem .4rem; border-radius: 4px; }
	.status.passed { background: #edf7f1; } .status.issues { background: #fff0ef; } .status.review { background: #fff6e3; }
	.row-details { font-size: .75rem; color: var(--color-text-muted); line-height: 1.6; overflow-wrap: anywhere; }
	.row-details ul { padding-left: 1rem; margin: 0; }
	.row-details ul + ul, .row-details li + li { margin-top: .5rem; }
	.errors { color: #a93535; } .coverage { color: #795613; }
	.export-note, .batch-footer { font-size: .73rem; color: var(--color-text-muted); line-height: 1.7; }
	.export-note { margin: 1rem 0; }
	.batch-footer { border-top: 1px solid var(--color-border); padding-top: 1rem; margin-top: 2rem; }
	.empty-filter { padding: 1.5rem; border: 1px solid var(--color-border); border-radius: 8px; font-size: .82rem; color: var(--color-text-muted); }
	.batch-empty { padding: 2.5rem 0 1rem; }
	.batch-empty span { font: .8rem var(--font-mono); color: var(--color-primary); }
	.batch-empty p { font-size: .85rem; color: var(--color-text-muted); }
	.result-announcement { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
	@media (max-width: 540px) { .batch-entry { padding: 1rem; } .filter-bar span { width: 100%; margin-left: 0; } }
</style>
