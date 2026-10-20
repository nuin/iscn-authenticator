<script lang="ts">
	import { tick } from 'svelte';
	import { buildFish } from '#lib/review/fish.ts';
	import { createFishRecord } from '#lib/review/records.ts';
	import { downloadValidationFile } from '#lib/validation.ts';
	import type { FishInput, FishReview } from '#lib/review/types.ts';
	let { onuse }: { onuse: (notation: string) => void } = $props();
	let input = $state<FishInput>({ probes: [{ name: '', signals: '' }], countMode: 'mixed', observedNuclei: '', totalNuclei: '', cutoffPercent: '', cutoffOperator: '>', protocol: '' });
	let review = $state<FishReview | null>(null);
	let copyMessage = $state('');
	let output: HTMLDivElement | undefined;
	const thresholds = { meets: 'Meets the entered threshold', 'does-not-meet': 'Does not meet the entered threshold', 'not-assessed': 'Threshold not assessed' };

	function invalidate() {
		review = null;
		copyMessage = '';
	}

	async function build() {
		copyMessage = '';
		review = buildFish(input);
		await tick();
		output?.focus({ preventScroll: true });
		output?.scrollIntoView({ block: 'start' });
	}

	function addProbe() {
		invalidate();
		input.probes.push({ name: '', signals: '' });
	}

	function removeProbe(index: number) {
		invalidate();
		input.probes.splice(index, 1);
	}

	async function copyNotation() {
		if (!review?.notation) return;
		try {
			await navigator.clipboard.writeText(review.notation);
			copyMessage = 'FISH notation copied.';
		} catch {
			copyMessage = 'Clipboard unavailable. Select the generated notation and copy it manually.';
		}
	}

	function downloadWorksheet() {
		if (!review?.notation) return;
		try {
			const record = createFishRecord($state.snapshot(input), $state.snapshot(review));
			downloadValidationFile(JSON.stringify(record, null, 2), 'iscn-fish-worksheet.json', 'application/json');
			copyMessage = 'FISH worksheet downloaded.';
		} catch (error) {
			copyMessage = error instanceof Error ? error.message : 'The worksheet could not be created. Build the notation again.';
		}
	}
</script>

<div class="fish-workspace">
	<section class="panel entry" aria-labelledby="fish-heading">
		<h2 id="fish-heading">Interphase FISH builder</h2>
		<p class="help">Build a copy-number expression for one hybridization. Supply probes in the order required by your laboratory. Fusion and break-apart patterns are outside this builder.</p>
		<form onsubmit={(event) => { event.preventDefault(); build(); }} oninput={invalidate} onchange={invalidate}>
			<fieldset><legend>Probes and signal counts</legend>
				{#each input.probes as probe, index}
					<div class="probe-row"><div class="field"><label for={`probe-name-${index}`}>Probe name {index + 1}</label><input id={`probe-name-${index}`} bind:value={probe.name} autocomplete="off" spellcheck="false" /></div><div class="field signals"><label for={`probe-signals-${index}`}>Signal count {index + 1}</label><input id={`probe-signals-${index}`} bind:value={probe.signals} inputmode="numeric" autocomplete="off" /></div>{#if input.probes.length > 1}<button type="button" class="remove" aria-label={`Remove probe ${index + 1}`} onclick={() => removeProbe(index)}>Remove</button>{/if}</div>
				{/each}
				<button type="button" class="button secondary add" onclick={addProbe}>Add probe</button>
			</fieldset>
			<div class="field"><label for="fish-count-mode">Nuclei reporting</label><select id="fish-count-mode" bind:value={input.countMode}><option value="mixed">Mixed normal and abnormal nuclei</option><option value="all-observed">One pattern in all nuclei</option><option value="constitutional-nonmosaic">Constitutional, non-mosaic</option></select></div>
			<div class="count-fields"><div class="field"><label for="observed-nuclei">Observed nuclei</label><input id="observed-nuclei" inputmode="numeric" bind:value={input.observedNuclei} autocomplete="off" aria-describedby="nuclei-help" /></div><div class="field"><label for="total-nuclei">Total nuclei</label><input id="total-nuclei" inputmode="numeric" bind:value={input.totalNuclei} autocomplete="off" /></div></div>
			<p class="help" id="nuclei-help">Observed nuclei carry the entered signal pattern. Choose the count format appropriate to the assay context.</p>
			<fieldset class="threshold"><legend>Laboratory threshold <span>(optional)</span></legend>
				<p class="help">No clinical cutoff is supplied. Enter your laboratory’s validated cutoff, boundary operator and protocol to compare the observed percentage.</p>
				<div class="cutoff-fields"><div class="field"><label for="cutoff-operator">Cutoff operator</label><select id="cutoff-operator" bind:value={input.cutoffOperator}><option value=">">Greater than (&gt;)</option><option value=">=">At least (≥)</option></select></div><div class="field"><label for="cutoff-percent">Laboratory cutoff (%)</label><input id="cutoff-percent" inputmode="decimal" bind:value={input.cutoffPercent} autocomplete="off" /></div></div>
				<div class="field"><label for="fish-protocol">Laboratory protocol or reference</label><input id="fish-protocol" bind:value={input.protocol} autocomplete="off" aria-describedby="protocol-help" /><p id="protocol-help" class="help">Required when a cutoff is entered.</p></div>
			</fieldset>
			<button type="submit" class="button">Build FISH notation</button>
		</form>
	</section>
	<div class="panel output" bind:this={output} role="region" aria-label="FISH builder result" tabindex="-1">
		{#if review}
			<h2>{review.notation ? 'Generated notation' : 'Check the entered details'}</h2>
			{#if review.notation}<pre class="notation" aria-label="Generated FISH notation">{review.notation}</pre>{/if}
			{#if review.issues.length}<ul class="issues">{#each review.issues as issue}<li>{issue.message}<small><code>{issue.code}</code> · {issue.reference}</small></li>{/each}</ul>{/if}
			{#if review.percentage !== null}<p class="percentage">Observed pattern: <strong>{Number(review.percentage.toFixed(2))}%</strong> of counted nuclei</p>{/if}
			<p class="threshold-result" role="status" aria-label="FISH threshold result">{thresholds[review.threshold]}</p>
			{#if input.cutoffPercent && review.threshold !== 'not-assessed'}<p class="help">Entered comparison: {input.cutoffOperator} {input.cutoffPercent}%. Protocol: {input.protocol}.</p>{/if}
			<p class="help">Meeting an entered threshold is not a clinical positive result. Interpretation depends on the validated assay, specimen and laboratory review.</p>
			{#if review.notation}<div class="actions"><button type="button" class="button" onclick={downloadWorksheet}>Download FISH worksheet JSON</button><button type="button" class="button secondary" onclick={copyNotation}>Copy FISH notation</button><button type="button" class="button secondary" onclick={() => review?.notation && onuse(review.notation)}>Use in report review</button></div><p class="help">Download the worksheet to retain the threshold and protocol. Only the notation transfers into a new report form.</p>{/if}
			<p class="help" role="status">{copyMessage}</p>
		{:else}
			<h2>Construct a bounded FISH expression</h2><p class="help">Enter the observed signal pattern and nuclei counts to generate notation. Add a laboratory cutoff only when your protocol specifies one.</p><p class="help">The builder checks the supplied tokens and counts. It does not identify probes, establish probe order or validate a clinical assay.</p>
		{/if}
		<a class="guide" href="/docs/fish-builder" target="_blank" rel="noopener noreferrer">FISH builder scope and worked examples (opens a new tab)</a>
	</div>
</div>

<style>
	.fish-workspace { display: grid; grid-template-columns: var(--review-workspace-columns, minmax(300px, 1fr) minmax(0, 1fr)); gap: 1.5rem; align-items: start; }
	.entry, .output { padding: 1.5rem; min-width: 0; }
	h2 { font-size: 1.2rem; margin-bottom: .8rem; }
	.help { font-size: .77rem; color: var(--color-text-muted); line-height: 1.7; }
	.field .help { margin: 0; }
	fieldset { min-width: 0; border: 0; padding: 0; margin: 1.3rem 0; }
	legend { font-weight: 600; font-size: .85rem; padding: 0; margin-bottom: .8rem; }
	legend span { font-weight: 400; color: var(--color-text-muted); }
	.probe-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, .7fr); gap: .6rem; align-items: end; margin-bottom: .8rem; }
	.probe-row .field { margin-bottom: 0; }
	.remove { grid-column: 1 / -1; justify-self: start; background: none; border: 0; padding: .25rem 0; color: var(--color-primary); text-decoration: underline; font-size: .76rem; }
	.add { font-size: .75rem; min-height: 40px; padding: .6rem 1rem; }
	.count-fields, .cutoff-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; }
	.count-fields .field { margin-bottom: .6rem; }
	.threshold { border-top: 1px solid var(--color-border); padding-top: 1rem; }
	.threshold legend { padding-right: .5rem; }
	.output { scroll-margin-top: 1rem; }
	.notation { white-space: pre-wrap; overflow-wrap: anywhere; font-size: .9rem; padding: 1rem; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 6px; }
	.issues { padding-left: 1.2rem; }
	.issues li { font-size: .83rem; margin-bottom: .9rem; }
	.issues small { display: block; font-size: .7rem; color: var(--color-text-muted); margin-top: .3rem; overflow-wrap: anywhere; }
	.percentage { font-size: .88rem; margin-top: 1.5rem; }
	.threshold-result { font-weight: 600; font-size: .92rem; border-top: 1px solid var(--color-border); padding-top: 1rem; }
	.actions { display: flex; flex-wrap: wrap; gap: .7rem; margin-top: 1.5rem; }
	.guide { display: inline-block; font-size: .77rem; margin-top: .75rem; }
	@media (max-width: 850px) { .fish-workspace { grid-template-columns: 1fr; } }
	@media (max-width: 480px) { .entry, .output { padding: 1.1rem; } .cutoff-fields { grid-template-columns: 1fr; gap: 0; } .actions .button { width: 100%; } }
</style>
