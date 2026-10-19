<script lang="ts">
	import Ideogram from '#lib/components/Ideogram.svelte';
	import { downloadValidationFile, type ValidationReview } from '#lib/validation.ts';

	let { review, input }: { review: ValidationReview; input: string } = $props();
	let copyMessage = $state('');
	const rawJSON = $derived(JSON.stringify(review.result, null, 2));
	const ast = $derived(review.result.parsed);
	const tone = $derived(review.status === 'Checks passed' ? 'passed' : review.status === 'Issues found' ? 'issues' : 'review');

	async function copyJSON() {
		try {
			await navigator.clipboard.writeText(rawJSON);
			copyMessage = 'JSON copied.';
		} catch {
			copyMessage = 'Clipboard unavailable. Use Download JSON instead.';
		}
	}
</script>

<section class="result" aria-label="Validation result">
	<header class="result-heading">
		<div>
			<p class="section-label">Review result</p>
			<h2 class={tone}><span aria-hidden="true">{tone === 'passed' ? '✓' : tone === 'issues' ? '!' : '↗'}</span>{review.status}</h2>
		</div>
		<span class="local-label">Browser check</span>
	</header>
	<p class="submitted mono">{input}</p>
	<p class="result-description">
		{#if review.status === 'Checks passed'}No issues were found by the implemented checks. Review the scope before using this result.
		{:else if review.status === 'Issues found'}Review the issues below, edit the notation, then run the check again.
		{:else}The parser accepted this input, but parts of the notation need manual review.{/if}
	</p>
	{#if review.result.errors.length}
		<div class="issue-box">
			<h3>{ast ? 'Check these details' : 'The notation could not be parsed'}</h3>
			<ul>{#each review.result.errors as error}<li>{error}</li>{/each}</ul>
			<p>Check separators, chromosome counts and breakpoint notation against your source.</p>
		</div>
	{/if}
	{#if review.coverage.length}
		<aside class="coverage-box" aria-label="Coverage limitations">
			<h3>Coverage needs attention</h3>
			<ul>{#each review.coverage as note}<li>{note.message}</li>{/each}</ul>
			<a href="/docs/coverage">Read the coverage guide →</a>
		</aside>
	{/if}
	{#if ast}
		<div class="facts">
			<div><span>Chromosome count</span><strong class="mono">{ast.chromosome_count ?? 'Not specified'}</strong></div>
			<div><span>Sex chromosomes</span><strong class="mono">{ast.sex_chromosomes || 'Not specified'}</strong></div>
			<div><span>Listed abnormalities</span><strong class="mono">{ast.abnormalities.length}</strong></div>
		</div>
		{#if ast.chromosome_count !== null}
			<div class="overview"><h3>Chromosome overview</h3><Ideogram {ast} /></div>
		{/if}
		<details class="parsed-details" open>
			<summary>Parsed notation</summary>
			<div class="parsed-content">
				{#if ast.abnormalities.length}
					<ul class="abnormalities">
						{#each ast.abnormalities as abnormality}
							<li><code>{abnormality.raw}</code><span>Type: {abnormality.type}{abnormality.chromosome ? ` · Chromosome: ${abnormality.chromosome}` : ''}</span></li>
						{/each}
					</ul>
				{:else}<p>No abnormalities are listed in the primary parsed karyotype.</p>{/if}
				{#if ast.cell_lines?.length}
					<h4>Cell lines</h4>
					<ol class="cell-lines">
						{#each ast.cell_lines as line}
							<li><code>{line.chromosome_count},{line.sex_chromosomes}{line.abnormalities.length ? ',' + line.abnormalities.map((item) => item.raw).join(',') : ''}</code><span>{line.count ? `${line.count} cells` : 'Cell count not specified'}</span></li>
						{/each}
					</ol>
				{/if}
				{#if ast.modifiers}
					<h4>Modifiers</h4>
					<dl class="modifiers">{#each Object.entries(ast.modifiers) as [name, value]}<dt>{name}</dt><dd><code>{String(value)}</code></dd>{/each}</dl>
				{/if}
			</div>
		</details>
	{/if}
	<div class="export-bar">
		<button type="button" class="button secondary" onclick={copyJSON}>Copy JSON</button>
		<button type="button" class="button quiet" onclick={() => downloadValidationFile(rawJSON, 'iscn-result.json', 'application/json')}>Download JSON</button>
		<p role="status">{copyMessage}</p>
	</div>
	<details class="raw-result"><summary>View raw result</summary><pre>{rawJSON}</pre></details>
	<footer>
		These checks do not certify full ISCN compliance or provide a clinical interpretation.
		Band existence and full chromosome-count coherence are not comprehensively checked.
		<a href="/docs/reading-results">How to read results →</a>
	</footer>
</section>

<style>
	.result { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius); min-width: 0; overflow: hidden; }
	.result-heading { padding: 1.5rem 1.5rem 0; display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
	h2 { font-size: 1.5rem; margin: .4rem 0 0; display: flex; align-items: center; gap: .6rem; }
	h2 span { display: grid; place-items: center; width: 1.7rem; height: 1.7rem; border: 1px solid currentColor; border-radius: 50%; font-size: 1rem; }
	h2.passed { color: #26704f; } h2.issues { color: #a93535; } h2.review { color: #855b0b; }
	.local-label { font-size: .7rem; color: var(--color-text-muted); border: 1px solid var(--color-border); border-radius: 20px; padding: .3rem .65rem; white-space: nowrap; }
	.submitted { margin: 1rem 1.5rem .5rem; overflow-wrap: anywhere; font-size: .92rem; }
	.result-description { color: var(--color-text-muted); font-size: .85rem; margin: .5rem 1.5rem 1.5rem; line-height: 1.6; }
	h3 { font-size: .95rem; margin: 0 0 .9rem; } h4 { font-size: .85rem; margin: 1.2rem 0 .5rem; }
	.issue-box, .coverage-box { margin: 1rem 1.5rem; padding: 1rem; border-left: 3px solid; font-size: .82rem; line-height: 1.6; overflow-wrap: anywhere; }
	.issue-box { background: #fff2f1; border-color: #b84242; color: #863333; }
	.coverage-box { background: #fff8e9; border-color: #ad7a1a; color: #6e5018; }
	.issue-box h3, .coverage-box h3 { margin-bottom: .5rem; }
	.issue-box ul, .coverage-box ul { margin: 0; padding-left: 1.2rem; }
	.issue-box li + li, .coverage-box li + li { margin-top: .5rem; }
	.issue-box p { margin: .75rem 0 0; }
	.coverage-box a { display: inline-block; margin-top: .6rem; }
	.facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-block: 1px solid var(--color-border); background: var(--color-bg); padding: 1.2rem 1.5rem; gap: 1rem; }
	.facts span { display: block; font-size: .7rem; color: var(--color-text-muted); margin-bottom: .4rem; }
	.facts strong { font-size: 1rem; overflow-wrap: anywhere; }
	.overview { padding: 1.5rem; }
	.parsed-details { border-top: 1px solid var(--color-border); }
	summary { padding: 1rem 1.5rem; font-size: .85rem; font-weight: 600; cursor: pointer; }
	.parsed-content { padding: 0 1.5rem 1rem; font-size: .82rem; }
	.parsed-content p { margin: 0; color: var(--color-text-muted); }
	.abnormalities { list-style: none; margin: 0; padding: 0; }
	.abnormalities li + li { border-top: 1px solid var(--color-border); margin-top: .75rem; padding-top: .75rem; }
	code { font-family: var(--font-mono); overflow-wrap: anywhere; }
	.abnormalities span, .cell-lines span { display: block; font-size: .75rem; margin-top: .3rem; color: var(--color-text-muted); }
	.cell-lines { padding-left: 1.2rem; } .cell-lines li + li { margin-top: .7rem; }
	.modifiers { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: .4rem 1rem; }
	.modifiers dd { margin: 0; }
	.export-bar { display: flex; flex-wrap: wrap; gap: .5rem; padding: 1rem 1.5rem; border-top: 1px solid var(--color-border); }
	.export-bar .button { font-size: .8rem; }
	.export-bar p { flex-basis: 100%; margin: 0; font-size: .8rem; color: var(--color-text-muted); }
	.export-bar p:empty { display: none; }
	.raw-result { border-top: 1px solid var(--color-border); }
	pre { margin: 0 1.5rem 1rem; padding: 1rem; overflow: auto; max-height: 360px; background: var(--color-bg); font-size: .75rem; font-family: var(--font-mono); }
	footer { padding: 1rem 1.5rem; background: var(--color-bg); color: var(--color-text-muted); font-size: .75rem; line-height: 1.65; border-top: 1px solid var(--color-border); }
	footer a { display: block; margin-top: .3rem; }
	@media (max-width: 540px) {
		.result-heading { display: block; } .local-label { display: none; }
		.facts { grid-template-columns: 1fr 1fr; } .facts > :last-child { grid-column: 1 / -1; }
	}
</style>
