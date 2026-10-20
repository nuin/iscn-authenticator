<script lang="ts">
	import { tick } from 'svelte';
	import { assessCnv, createCnvRecord } from '#lib/review/cnv.ts';
	import { cnvCriteria, CNV_FRAMEWORK, CNV_SECTIONS } from '#lib/review/cnv-criteria.ts';
	import type { CnvInput, CnvResult } from '#lib/review/cnv-types.ts';

	let input = $state<CnvInput>({
		chromosome: '', start: '', end: '', assembly: '', direction: 'loss', geneCount: '',
		reviewer: '', assessmentDate: '', evidence: [],
		sectionReviews: CNV_SECTIONS.map((_, index) => ({ section: index + 1, reviewed: false, note: '' })),
		constitutionalConfirmed: false, supportedOnly: false, independenceConfirmed: false, populationCaveatsReviewed: false,
		conflictRationale: '', patientInterpretation: ''
	});
	let result = $state<CnvResult | null>(null);
	let exported = $state(false);
	let outputRegion: HTMLDivElement | undefined;
	const criteria = $derived(cnvCriteria(input.direction));

	function clearResult() { result = null; exported = false; }

	function evidenceChanged() {
		clearResult();
		for (const section of input.sectionReviews) section.reviewed = false;
		input.independenceConfirmed = false;
		input.supportedOnly = false;
		input.populationCaveatsReviewed = false;
		input.conflictRationale = '';
	}

	function directionChanged() {
		for (const evidence of input.evidence) { evidence.criterion = ''; evidence.score = ''; }
		evidenceChanged();
	}

	function addEvidence() {
		input.evidence.push({ criterion: '', score: '', evidenceId: '', citation: '', rationale: '' });
		evidenceChanged();
	}

	function removeEvidence(index: number) { input.evidence.splice(index, 1); evidenceChanged(); }

	async function calculate() {
		result = assessCnv(input);
		await tick();
		outputRegion?.focus({ preventScroll: true });
	}

	function exportRecord() {
		const record = createCnvRecord($state.snapshot(input), new Date().toISOString());
		const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'cnv-evidence-worksheet.json';
		anchor.click();
		URL.revokeObjectURL(url);
		exported = true;
	}
</script>

<section class="cnv-workspace" aria-labelledby="cnv-heading">
	<header>
		<p class="section-label">Constitutional CNV evidence</p>
		<h2 id="cnv-heading">Document the evidence behind a score.</h2>
		<p>Record your assessment using selected ACMG/ClinGen categories. A score is provisional and depends on the evidence you supply. ISCN notation does not establish pathogenicity.</p>
		<a href="/docs/cnv-evidence" target="_blank" rel="noopener noreferrer">Worksheet instructions and supported categories (opens a new tab)</a>
	</header>
	<form onsubmit={(event) => { event.preventDefault(); calculate(); }} oninput={clearResult} onchange={clearResult} autocomplete="off" novalidate>
		<fieldset oninput={evidenceChanged}>
			<legend>1. Identify the CNV</legend>
			<p class="help">Use 1-based inclusive coordinates and non-identifying references. Check the interval against the genome. Assess RefSeq coding genes, accounting for gene families as described in the guideline supplement; no gene annotation runs here.</p>
			<div class="field-grid">
				<label>CNV chromosome<input bind:value={input.chromosome} placeholder="1–22, X or Y" /></label>
				<label>Genome assembly<select bind:value={input.assembly}><option value="">Choose assembly</option><option>GRCh37</option><option>GRCh38</option></select></label>
				<label>CNV direction<select bind:value={input.direction} onchange={directionChanged}><option value="loss">Loss</option><option value="gain">Gain</option></select></label>
				<label>Start coordinate<input bind:value={input.start} inputmode="numeric" /></label>
				<label>End coordinate<input bind:value={input.end} inputmode="numeric" /></label>
				<label>Assessed coding gene count<input bind:value={input.geneCount} inputmode="numeric" /></label>
			</div>
		</fieldset>
		<fieldset>
			<legend>2. Add sourced evidence</legend>
			<p class="help">One category per section. Sections 1, 3 and 5 require an entry, including zero-point assessments. Sections 2 and 4 can be skipped with a documented reason. Use a different evidence-unit ID for each independent observation; the same paper may contain several observations.</p>
			<p class="help">Supported: content, full established dosage-sensitive/benign overlap, gene count, population frequency and uninformative inheritance. Other applicable evidence requires an external assessment; do not omit it to obtain a score.</p>
			<p class="help">Established HI/TS evidence means ClinGen dosage score 3; established benign evidence means dosage sensitivity unlikely. Match gain/loss and the source’s actual interval. A generic database pathogenicity label does not establish these criteria.</p>
			{#each input.evidence as entry, index}
				<fieldset class="evidence-entry" oninput={evidenceChanged} onchange={evidenceChanged}>
					<legend>Evidence {index + 1}</legend>
					<div class="field-grid">
						<label>Criterion {index + 1}<select bind:value={entry.criterion}><option value="">Choose a category</option>{#each criteria as criterion}<option value={criterion.code}>{criterion.code} · {criterion.label}</option>{/each}</select></label>
						<label>Points {index + 1}<input bind:value={entry.score} inputmode="decimal" placeholder="Enter assessed points" /></label>
					</div>
					{#each criteria.filter(criterion => criterion.code === entry.criterion) as criterion}
						<p class="help">Allowed points: {criterion.min / 100}{criterion.max !== criterion.min ? ` to ${criterion.max / 100}` : ''}. At most two decimal places. Read the source criterion and justify the assigned value.</p>
					{/each}
					<label>Evidence-unit ID {index + 1}<input bind:value={entry.evidenceId} placeholder="Non-identifying observation or cohort reference" /></label>
					<label>Citation and source version {index + 1}<input bind:value={entry.citation} placeholder="DOI, database accession/release, or internal reference" /></label>
					<label>Evidence rationale {index + 1}<textarea bind:value={entry.rationale} rows="2" placeholder="Why the criterion applies, limitations and chosen points"></textarea></label>
					<button type="button" class="text-button" onclick={() => removeEvidence(index)}>Remove evidence {index + 1}</button>
				</fieldset>
			{/each}
			<button type="button" class="button secondary" onclick={addEvidence}>Add evidence</button>
		</fieldset>
		<fieldset>
			<legend>3. Complete the assessment</legend>
			<p class="help">Record sources searched and why evidence was selected or excluded. Evidence or identity edits clear these review confirmations.</p>
			{#each input.sectionReviews as section, index}
				<div class="section-review">
					<label>Section {section.section}: {CNV_SECTIONS[index]}<textarea bind:value={section.note} oninput={() => { section.reviewed = false; }} rows="2" placeholder="Sources reviewed, relevant findings, or justified skip"></textarea></label>
					<label class="check"><input type="checkbox" bind:checked={section.reviewed} />Section {section.section} reviewed</label>
				</div>
			{/each}
			<label class="check"><input type="checkbox" bind:checked={input.constitutionalConfirmed} />This is a constitutional CNV, with validated detection, meeting our laboratory’s reporting criteria.</label>
			<label class="check"><input type="checkbox" bind:checked={input.supportedOnly} />I reviewed the complete guideline; no applicable evidence requires a category omitted from this worksheet.</label>
			<label class="check"><input type="checkbox" bind:checked={input.independenceConfirmed} />I checked for reused cases, cohorts and correlated evidence, and justified independence.</label>
			{#if input.evidence.some(entry => entry.criterion === '4O')}
				<label class="check"><input type="checkbox" bind:checked={input.populationCaveatsReviewed} />For 4O, I checked matching dosage and gene content, dataset quality, penetrance, sex and carrier status. I am not using frequency to dismiss an established recessive loss-of-function disease gene.</label>
			{/if}
			<label>Reconciliation of opposing evidence<textarea bind:value={input.conflictRationale} rows="2" placeholder="Required if positive and negative points coexist"></textarea></label>
			<div class="field-grid">
				<label>CNV reviewer<input bind:value={input.reviewer} /></label>
				<label>Assessment date<input type="date" bind:value={input.assessmentDate} /></label>
			</div>
			<label>Patient-specific interpretation (separate, optional)<textarea bind:value={input.patientInterpretation} rows="3" placeholder="Clinical relevance and limitations; omit patient identifiers"></textarea></label>
		</fieldset>
		<div class="actions"><button type="submit" class="button">Calculate provisional score</button><button type="button" class="button secondary" onclick={exportRecord}>Export CNV worksheet JSON</button></div>
		<p class="help">Entries stay in this browser’s memory. Export explicitly to keep a draft or assessment. Downloads contain editable, unauthenticated reviewer statements.</p>
	</form>
	<div class="result" bind:this={outputRegion} role="region" aria-label="CNV worksheet result" tabindex="-1">
		<div role="status" aria-live="polite">{exported ? 'CNV worksheet exported.' : ''}</div>
		{#if result}
			{#if result.status === 'provisional'}
				<h3>Provisional score: {result.score?.toFixed(2)}</h3>
				<p><strong>Provisional category: {result.provisionalClassification}</strong></p>
				<p>Reviewer-assessed evidence still requires laboratory review before clinical use. Patient-specific relevance is recorded separately.</p>
			{:else}
				<h3>Assessment incomplete — no score or category</h3>
				<ul>{#each result.issues as issue}<li>{issue.message}</li>{/each}</ul>
			{/if}
			<details><summary>Scope and record limitations</summary><ul>{#each result.limitations as limitation}<li>{limitation}</li>{/each}</ul></details>
		{/if}
	</div>
	<p class="reference">Framework: <a href={CNV_FRAMEWORK.url} target="_blank" rel="noreferrer">Riggs et al. (2020), Tables 1 and 2</a>, with the <a href="https://doi.org/10.1038/s41436-021-01150-9" target="_blank" rel="noreferrer">2021 correction</a> · Worksheet {CNV_FRAMEWORK.worksheetVersion}. <a href={CNV_FRAMEWORK.clarifications} target="_blank" rel="noreferrer">ClinGen clarifications</a>.</p>
</section>

<style>
	.cnv-workspace { max-width: 960px; margin-inline: auto; }
	header { margin-bottom: 1.75rem; max-width: 750px; }
	h2 { font-size: clamp(1.5rem, 3vw, 2rem); line-height: 1.2; letter-spacing: -.025em; margin: .5rem 0 .8rem; }
	p { line-height: 1.7; }
	header > p:not(.section-label) { color: var(--color-text-muted); }
	fieldset { min-width: 0; padding: 1.4rem; margin: 0 0 1.4rem; border: 1px solid var(--color-border); border-radius: var(--radius); background: var(--color-surface); }
	legend { padding-inline: .4rem; font-size: 1rem; font-weight: 650; }
	.field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 1rem; }
	label { display: block; font-size: .82rem; font-weight: 600; margin-block: .5rem 1rem; }
	input:not([type=checkbox]), select, textarea { display: block; width: 100%; min-width: 0; box-sizing: border-box; margin-top: .45rem; padding: .7rem; color: var(--color-text); border: 1px solid #a6bccb; border-radius: 6px; background: #fbfdff; font: inherit; font-weight: 400; }
	textarea { resize: vertical; line-height: 1.6; }
	input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid #a4dbe5; outline-offset: 2px; }
	.help, .reference { font-size: .76rem; color: var(--color-text-muted); margin-block: 0 1rem; }
	.evidence-entry { margin-top: 1.4rem; background: #f7fafc; }
	.text-button { padding: .3rem 0; color: var(--color-primary); background: none; border: 0; text-decoration: underline; cursor: pointer; font: inherit; font-size: .8rem; }
	.check { display: flex; align-items: flex-start; gap: .6rem; font-weight: 400; line-height: 1.6; }
	.check input { margin: .25rem 0 0; flex-shrink: 0; }
	.section-review { border-bottom: 1px solid var(--color-border); margin-bottom: 1.25rem; }
	.actions { display: flex; gap: .8rem; flex-wrap: wrap; margin-bottom: 1rem; }
	.secondary { background: var(--color-surface); color: var(--color-primary); border: 1px solid var(--color-border); }
	.result { scroll-margin-top: 1rem; overflow-wrap: anywhere; }
	.result:has(h3) { padding: 1.4rem; margin-block: 1.5rem; border: 1px solid var(--color-border); border-left: 4px solid var(--color-primary); border-radius: var(--radius); background: var(--color-surface); }
	.result h3 { margin-top: 0; }
	.result p, .result li { font-size: .88rem; line-height: 1.7; }
	.result li { margin-bottom: .4rem; }
	summary { cursor: pointer; font-size: .84rem; font-weight: 600; }
	.reference { margin-top: 1.5rem; }
	@media (max-width: 600px) { .field-grid { grid-template-columns: 1fr; } fieldset { padding: 1rem; } }
</style>
