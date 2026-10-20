<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import Ideogram from '#lib/components/Ideogram.svelte';
	import ValidationResult from '#lib/components/ValidationResult.svelte';
	import { reviewKaryotype, type ValidationReview } from '#lib/validation.ts';
	import type { KaryotypeAST } from '@iscn/core';

	let input = $state('');
	let submitted = $state('');
	let review = $state<ValidationReview | null>(null);
	let inputError = $state('');
	let resultRegion: HTMLDivElement | undefined;
	const reference: KaryotypeAST = { chromosome_count: 46, sex_chromosomes: 'XX', abnormalities: [], cell_lines: null, modifiers: null };
	const examples = [
		{ name: 'Chromosome gain', value: '47,XY,+21' },
		{ name: 'Deletion', value: '46,XX,del(5)(q13q33)' },
		{ name: 'Translocation', value: '46,XX,t(9;22)(q34;q11.2)' },
		{ name: 'Multiple cell lines', value: '47,XX,+21[5]/46,XX[10]' }
	];

	$effect(() => {
		input = page.url.searchParams.get('karyotype') ?? '';
		review = null;
		inputError = '';
	});

	async function runCheck() {
		if (!input.trim()) {
			inputError = 'Enter a karyotype or choose an example below.';
			review = null;
			return;
		}
		inputError = '';
		submitted = input.trim();
		review = reviewKaryotype(submitted);
		await tick();
		resultRegion?.focus({ preventScroll: true });
		resultRegion?.scrollIntoView({ block: 'start' });
	}

	function editInput() {
		review = null;
		inputError = '';
	}

	function useExample(value: string) {
		input = value;
		runCheck();
	}
</script>

<svelte:head>
	<title>Karyotype workspace · ISCN Authenticator</title>
	<meta name="description" content="Review karyotype notation in your browser, inspect implemented checks and coverage limits, and export the raw result." />
</svelte:head>

<div class="page-shell validation-page">
	<header class="page-heading">
		<p class="section-label">Karyotype workspace</p>
		<h1>Review the notation.<br /><span>See what was checked.</span></h1>
		<p>Run supported syntax and consistency checks, inspect the parsed notation, and keep the result with your review.</p>
	</header>
	<div class="workspace">
		<div class="entry-column">
			<section class="entry-panel" aria-labelledby="entry-heading">
				<div class="entry-heading"><span class="step">01</span><h2 id="entry-heading">Enter a karyotype</h2></div>
				<form onsubmit={(event) => { event.preventDefault(); runCheck(); }}>
					<label for="karyotype">ISCN notation</label>
					<textarea id="karyotype" bind:value={input} oninput={editInput} placeholder="46,XX,t(9;22)(q34;q11.2)" rows="4" spellcheck="false" autocomplete="off" autocapitalize="off" aria-describedby={inputError ? 'input-help input-error' : 'input-help'} aria-invalid={Boolean(inputError)}></textarea>
					<p id="input-help" class="input-help">Paste notation only. Leave patient names and identifiers out of this workspace.</p>
					{#if inputError}<p id="input-error" class="input-error" role="alert">{inputError}</p>{/if}
					<div class="input-actions">
						<button type="submit" class="button">Check karyotype <span aria-hidden="true">→</span></button>
						{#if input}<button type="button" class="clear-button" onclick={() => { input = ''; editInput(); }}>Clear</button>{/if}
					</div>
				</form>
				<div class="local-note"><span aria-hidden="true">◉</span><p>Runs in this browser. Your entry is not sent to a validation server or saved by this workspace.</p></div>
			</section>
			<section class="examples" aria-labelledby="examples-heading">
				<h2 id="examples-heading">Start with an example</h2>
				{#each examples as example}
					<button type="button" onclick={() => useExample(example.value)}><span>{example.name}<span aria-hidden="true">↗</span></span><code>{example.value}</code></button>
				{/each}
			</section>
			<nav class="workspace-links" aria-label="Workspace guides">
				<a href="/review">Review a laboratory report <span aria-hidden="true">→</span></a>
				<a href="/docs/report-review" target="_blank" rel="noopener noreferrer">Laboratory review guide (opens a new tab)</a>
				<a href="/docs/coverage">What the validator covers <span aria-hidden="true">→</span></a>
				<a href="/dashboard/batch">Review a batch <span aria-hidden="true">→</span></a>
			</nav>
		</div>
		<div class="result-column" bind:this={resultRegion} role="region" aria-label="Validation output" tabindex="-1">
			<div class="sr-only" role="status">{review ? `${review.status}. ${review.result.errors.length} issues. ${review.coverage.length} coverage notes.` : ''}</div>
			{#if review}
				{#key review}<ValidationResult {review} input={submitted} />{/key}
			{:else}
				<section class="empty-result" aria-labelledby="empty-heading">
					<div class="empty-heading"><span class="step">02</span><p class="section-label">Review the result</p></div>
					<h2 id="empty-heading">A clearer view of your notation.</h2>
					<p>Enter a karyotype to see any issues, parsed details and the parts that need further review.</p>
					<div class="reference"><p class="reference-label">Reference banding · no result yet</p><Ideogram ast={reference} /></div>
					<div class="empty-footer"><span class="step">03</span><p>Export the raw JSON for your records.<br /><a href="/docs/reading-results">Learn how to read the result →</a></p></div>
				</section>
			{/if}
		</div>
	</div>
	<p class="scope-note">A notation review tool for the implemented checks. Results are not a clinical interpretation or certification of full ISCN compliance. <a href="/docs/coverage">Read the scope and limitations.</a></p>
</div>

<style>
	.validation-page { padding-block: 3.5rem 4rem; }
	.page-heading { max-width: 720px; margin-bottom: 2.5rem; }
	.page-heading h1 { font-size: clamp(2rem, 4vw, 3.1rem); line-height: 1.15; letter-spacing: -.04em; margin: .75rem 0 1rem; }
	.page-heading h1 span { color: var(--color-primary); }
	.page-heading > p:last-child { max-width: 590px; color: var(--color-text-muted); font-size: 1rem; line-height: 1.7; }
	.workspace { display: grid; grid-template-columns: minmax(300px, .8fr) minmax(0, 1.35fr); gap: 2rem; align-items: start; }
	.entry-column, .result-column { min-width: 0; }
	.result-column { scroll-margin-top: 1rem; }
	.entry-panel { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); padding: 1.5rem; }
	.entry-heading { display: flex; align-items: center; gap: .75rem; margin-bottom: 1.5rem; }
	.entry-heading h2 { font-size: 1.05rem; margin: 0; }
	.step { font-family: var(--font-mono); color: var(--color-primary); font-size: .72rem; border: 1px solid #bad5de; border-radius: 50%; display: inline-grid; place-items: center; width: 1.8rem; height: 1.8rem; flex-shrink: 0; }
	label { display: block; font-weight: 600; font-size: .8rem; margin-bottom: .6rem; }
	textarea { width: 100%; box-sizing: border-box; background: #fbfdff; padding: .9rem; border: 1px solid #a6bccb; border-radius: 6px; font: .88rem/1.8 var(--font-mono); color: var(--color-text); resize: vertical; min-height: 130px; }
	textarea:focus-visible { outline: 3px solid #a4dbe5; outline-offset: 2px; }
	textarea[aria-invalid='true'] { border-color: #b84242; }
	.input-help { font-size: .73rem; line-height: 1.6; color: var(--color-text-muted); margin: .6rem 0 1.2rem; }
	.input-error { color: #a93535; font-size: .8rem; line-height: 1.6; }
	.input-actions { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
	.input-actions .button { display: inline-flex; align-items: center; justify-content: space-between; gap: 1.25rem; }
	.clear-button { border: 0; background: none; padding: .5rem 0; font: inherit; font-size: .82rem; color: var(--color-text-muted); text-decoration: underline; cursor: pointer; }
	.local-note { display: flex; gap: .7rem; border-top: 1px solid var(--color-border); padding-top: 1rem; margin-top: 1.3rem; color: var(--color-primary); }
	.local-note > span { font-size: .8rem; margin-top: .1rem; }
	.local-note p { margin: 0; font-size: .73rem; line-height: 1.6; }
	.examples { margin-top: 1.8rem; }
	.examples h2 { font-size: .8rem; margin: 0 0 .6rem; color: var(--color-text-muted); }
	.examples button { display: block; text-align: left; width: 100%; padding: .85rem 0; border: 0; border-bottom: 1px solid var(--color-border); background: none; cursor: pointer; color: var(--color-text); }
	.examples button > span { display: flex; justify-content: space-between; font-size: .84rem; margin-bottom: .3rem; }
	.examples button > span > span { color: var(--color-primary); }
	.examples code { font-family: var(--font-mono); font-size: .71rem; color: var(--color-text-muted); overflow-wrap: anywhere; }
	.examples button:hover > span { color: var(--color-primary); }
	.workspace-links { display: flex; flex-direction: column; gap: .7rem; margin-top: 1.5rem; }
	.workspace-links a { display: flex; justify-content: space-between; gap: 1rem; font-size: .8rem; text-decoration: none; }
	.empty-result { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius); padding: 1.5rem; }
	.empty-heading { display: flex; align-items: center; gap: .75rem; margin-bottom: 1.5rem; }
	.empty-heading p { margin: 0; }
	.empty-result h2 { font-size: 1.45rem; line-height: 1.3; margin: 0 0 .8rem; letter-spacing: -.02em; }
	.empty-result > p { color: var(--color-text-muted); font-size: .88rem; line-height: 1.7; max-width: 420px; }
	.reference { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--color-border); }
	.reference-label { font-size: .72rem; margin: 0 0 1rem; font-weight: 600; color: var(--color-text-muted); }
	.empty-footer { display: flex; align-items: flex-start; gap: .8rem; border-top: 1px solid var(--color-border); padding-top: 1.3rem; margin-top: 1.5rem; }
	.empty-footer p { margin: 0; font-size: .8rem; line-height: 1.8; }
	.scope-note { max-width: 850px; font-size: .75rem; color: var(--color-text-muted); line-height: 1.7; margin: 2.5rem 0 0; }
	.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
	@media (max-width: 850px) { .workspace { grid-template-columns: 1fr; gap: 1.5rem; } .validation-page { padding-top: 2rem; } }
</style>
