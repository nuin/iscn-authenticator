<script lang="ts">
	import { tick } from 'svelte';
	import { reviewReport } from '#lib/review/report.ts';
	import type { ReportInput, ReportReview } from '#lib/review/types.ts';
	import ReportResult from './ReportResult.svelte';
	import ReviewSignoff from './ReviewSignoff.svelte';

	const emptyInput = (): ReportInput => ({ notation: '', previousNotation: '', analyzedCells: '', context: 'unspecified', conclusion: 'not-entered', reportText: '' });
	let input = $state<ReportInput>(emptyInput());
	let review = $state<ReportReview | null>(null);
	let inputError = $state('');
	let resultRegion: HTMLDivElement | undefined;
	let notationField: HTMLTextAreaElement | undefined;

	function invalidate() {
		review = null;
		inputError = '';
	}

	async function runReview() {
		invalidate();
		if (!input.notation.trim()) {
			inputError = 'Enter current ISCN notation to review the report.';
			notationField?.focus();
			return;
		}
		review = reviewReport(input);
		await tick();
		resultRegion?.focus({ preventScroll: true });
		resultRegion?.scrollIntoView({ block: 'start' });
	}

	function useExample() {
		invalidate();
		input = { notation: '47,XX,+21[5]/46,XX[15]', previousNotation: '46,XX[20]', analyzedCells: '20', context: 'constitutional', conclusion: 'abnormality-detected', reportText: '' };
	}

	export function useNotation(notation: string) {
		invalidate();
		input = { ...emptyInput(), notation };
		notationField?.focus();
	}
</script>

<div class="report-workspace">
	<section class="panel entry" aria-labelledby="report-entry-heading">
		<div class="entry-heading"><h2 id="report-entry-heading">Report details</h2><button type="button" class="example" onclick={useExample}>Use synthetic example</button></div>
		<p class="help">Enter notation and review context. Leave patient names and identifiers out of every field.</p>
		<form onsubmit={(event) => { event.preventDefault(); runReview(); }} oninput={invalidate} onchange={invalidate}>
			<div class="field">
				<label for="current-notation">Current ISCN notation</label>
				<textarea id="current-notation" bind:this={notationField} bind:value={input.notation} rows="3" spellcheck="false" autocomplete="off" autocapitalize="off" aria-invalid={Boolean(inputError)} aria-describedby={inputError ? 'report-input-error' : undefined}></textarea>
			</div>
			{#if inputError}<p id="report-input-error" class="error" role="alert">{inputError}</p>{/if}
			<div class="field">
				<label for="previous-notation">Previous ISCN notation <span>(optional)</span></label>
				<textarea id="previous-notation" bind:value={input.previousNotation} rows="2" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
			</div>
			<div class="field"><label for="analyzed-cells">Declared analyzed cells <span>(optional)</span></label><input id="analyzed-cells" inputmode="numeric" bind:value={input.analyzedCells} autocomplete="off" /></div>
			<div class="field"><label for="specimen-context">Specimen context</label><select id="specimen-context" bind:value={input.context}><option value="unspecified">Not specified</option><option value="constitutional">Constitutional</option><option value="neoplastic">Neoplastic</option></select></div>
			<div class="field"><label for="report-conclusion">Structured conclusion</label><select id="report-conclusion" bind:value={input.conclusion}><option value="not-entered">Not entered</option><option value="no-abnormality">No abnormality detected</option><option value="abnormality-detected">Abnormality detected</option></select></div>
			<div class="field"><label for="report-narrative">Report narrative <span>(optional)</span></label><textarea id="report-narrative" bind:value={input.reportText} rows="3" autocomplete="off" aria-describedby="narrative-help"></textarea><p class="help" id="narrative-help">Retained in the export for human review. Narrative meaning is not checked.</p></div>
			<button type="submit" class="button">Review report</button>
		</form>
	</section>
	<div class="result-column" bind:this={resultRegion} role="region" aria-label="Report review result" tabindex="-1">
		<p class="sr-only" role="status">{review ? `${review.status}. ${review.issues.length} report review notes.` : ''}</p>
		{#if review}
			{#key review}<ReportResult {input} {review} /><ReviewSignoff {input} {review} />{/key}
		{:else}
			<section class="panel empty" aria-labelledby="ready-heading">
				<h2 id="ready-heading">Ready for review</h2>
				<p>Check the notation against the declared cell total and structured conclusion. Add a previous result to compare the listed findings.</p>
				<ol><li>Enter report details or load the synthetic example.</li><li>Inspect cell counts, discrepancies and coverage limits.</li><li>Record your review and explicitly download a local record.</li></ol>
				<p class="note">Editing any report field clears the result and reviewer details. Run the review again before exporting.</p>
			</section>
		{/if}
	</div>
</div>

<style>
	.report-workspace { display: grid; grid-template-columns: var(--review-workspace-columns, minmax(300px, .85fr) minmax(0, 1.15fr)); align-items: start; gap: 1.5rem; }
	.entry, .empty { padding: 1.5rem; }
	.entry-heading { display: flex; align-items: baseline; justify-content: space-between; gap: .75rem; flex-wrap: wrap; margin-bottom: .75rem; }
	h2 { font-size: 1.2rem; margin: 0; }
	.example { padding: .3rem 0; border: 0; background: none; color: var(--color-primary); text-decoration: underline; text-underline-offset: .2em; font-size: .78rem; }
	.help { font-size: .77rem; color: var(--color-text-muted); line-height: 1.7; margin-bottom: 1.1rem; }
	.field .help { margin: 0; }
	.field label span { font-weight: 400; color: var(--color-text-muted); }
	textarea { resize: vertical; }
	#current-notation, #previous-notation { font-family: var(--font-mono); font-size: .85rem; line-height: 1.8; }
	.error { color: #a13131; font-size: .85rem; }
	.result-column { min-width: 0; scroll-margin-top: 1rem; }
	.empty h2 { margin-bottom: 1rem; }
	.empty p, .empty li { font-size: .88rem; color: var(--color-text-muted); line-height: 1.8; }
	.empty ol { padding-left: 1.3rem; margin-block: 1.5rem; }
	.empty li + li { margin-top: .7rem; }
	.note { border-top: 1px solid var(--color-border); padding-top: 1rem; margin-bottom: 0; }
	@media (max-width: 850px) { .report-workspace { grid-template-columns: 1fr; } }
</style>
