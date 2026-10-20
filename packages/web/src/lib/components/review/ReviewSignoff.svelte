<script lang="ts">
	import { createReviewRecord, reviewRecordCSV } from '#lib/review/records.ts';
	import { downloadValidationFile } from '#lib/validation.ts';
	import type { ReportInput, ReportReview, ReviewSignoff } from '#lib/review/types.ts';
	let { input, review }: { input: ReportInput; review: ReportReview } = $props();
	let reviewer = $state('');
	let disposition = $state<ReviewSignoff['disposition'] | ''>('');
	let rationale = $state('');
	let acknowledgedLimits = $state(false);
	let exportError = $state('');
	let exportMessage = $state('');
	const ready = $derived(Boolean(reviewer.trim() && disposition && rationale.trim() && acknowledgedLimits));

	function exportRecord(format: 'json' | 'csv') {
		exportError = '';
		exportMessage = '';
		if (!disposition) return;
		try {
			const record = createReviewRecord($state.snapshot(input), $state.snapshot(review), { reviewer, disposition, rationale, acknowledgedLimits });
			const content = format === 'json' ? JSON.stringify(record, null, 2) : reviewRecordCSV(record);
			downloadValidationFile(content, `iscn-review.${format}`, format === 'json' ? 'application/json' : 'text/csv;charset=utf-8');
			exportMessage = `${format.toUpperCase()} review record downloaded.`;
		} catch (error) {
			exportError = error instanceof Error ? error.message : 'The review record could not be created. Run the review again.';
		}
	}

	function clearMessage() {
		exportError = '';
		exportMessage = '';
	}
</script>

<section class="panel signoff" aria-labelledby="signoff-heading">
	<h2 id="signoff-heading">Record your review</h2>
	<p class="help">Enter your assessment of this result, including any unresolved issues. All fields below are required to export.</p>
	<form onsubmit={(event) => event.preventDefault()} oninput={clearMessage} onchange={clearMessage}>
		<div class="field"><label for="reviewer-name">Reviewer name</label><input id="reviewer-name" bind:value={reviewer} autocomplete="off" /></div>
		<div class="field"><label for="review-disposition">Disposition</label><select id="review-disposition" bind:value={disposition}><option value="">Choose a disposition</option><option value="reviewed" disabled={review.status === 'Issues found'}>Reviewed</option><option value="follow-up">Follow-up required</option></select>{#if review.status === 'Issues found'}<p class="help">Unresolved issues require the follow-up disposition.</p>{/if}</div>
		<div class="field"><label for="review-rationale">Review rationale</label><textarea id="review-rationale" bind:value={rationale} rows="3" autocomplete="off"></textarea></div>
		<label class="acknowledgement"><input type="checkbox" bind:checked={acknowledgedLimits} /><span>I acknowledge the scope and limitations<span class="help">This is a local, self-attested record. It is not an authenticated electronic signature or an immutable audit trail, and the checks do not provide a clinical interpretation.</span></span></label>
		<div class="actions"><button type="button" class="button" disabled={!ready} onclick={() => exportRecord('json')}>Download review JSON</button><button type="button" class="button secondary" disabled={!ready} onclick={() => exportRecord('csv')}>Download review CSV</button></div>
		{#if exportError}<p class="error" role="alert">{exportError}</p>{/if}
		<p class="help message" role="status">{exportMessage}</p>
	</form>
</section>

<style>
	.signoff { margin-top: 1.5rem; padding: 1.5rem; }
	h2 { font-size: 1.2rem; margin-bottom: .75rem; }
	.help { color: var(--color-text-muted); font-size: .77rem; line-height: 1.7; }
	textarea { resize: vertical; }
	.acknowledgement { display: flex; align-items: flex-start; gap: .7rem; font-size: .83rem; margin-bottom: 1.2rem; cursor: pointer; }
	.acknowledgement input { margin-top: .3rem; accent-color: var(--color-primary); }
	.acknowledgement .help { display: block; margin-top: .5rem; }
	.actions { display: flex; flex-wrap: wrap; gap: .7rem; }
	.error { color: #a13131; font-size: .85rem; margin-block: 1rem 0; }
	.message { margin-block: .75rem 0; }
	.message:empty { display: none; }
	@media (max-width: 480px) { .signoff { padding: 1.1rem; } .actions .button { width: 100%; } }
</style>
