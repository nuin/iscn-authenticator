<script lang="ts">
	import { tick } from 'svelte';
	import ReportWorkspace from '#lib/components/review/ReportWorkspace.svelte';
	import FishBuilder from '#lib/components/review/FishBuilder.svelte';
	import CnvWorksheet from '#lib/components/review/CnvWorksheet.svelte';
	import ReviewGuide from '#lib/components/review/ReviewGuide.svelte';
	let active = $state('report');
	let showGuide = $state(false);
	const guideSlug = $derived(active === 'fish' ? 'fish-builder' : active === 'cnv' ? 'cnv-evidence' : 'report-review');
	let reportWorkspace: { useNotation: (notation: string) => void } | undefined;
	const sections = [{ id: 'report', label: 'Report QC' }, { id: 'fish', label: 'FISH builder' }, { id: 'cnv', label: 'CNV evidence' }];

	async function useFishNotation(notation: string) {
		active = 'report';
		await tick();
		reportWorkspace?.useNotation(notation);
	}
</script>

<svelte:head>
	<title>Laboratory report review · ISCN Authenticator</title>
	<meta name="description" content="Review notation, report consistency and cell counts, construct bounded FISH expressions, and document constitutional CNV evidence locally in your browser." />
</svelte:head>

<div class="page-shell review-page">
	<header class="page-heading"><h1>Laboratory report review</h1><p>Check report consistency, construct FISH notation and document CNV evidence. Keep the source details and your assessment together in a local review record.</p></header>
	<div class="privacy-note"><p>Runs in this browser. Entries stay in memory until you leave or reload the page; download a record to keep it. Do not enter patient identifiers.</p><button type="button" class="guide-toggle" aria-expanded={showGuide} aria-controls="workspace-documentation" onclick={() => showGuide = !showGuide}>{showGuide ? 'Hide documentation' : 'Show documentation'}</button></div>
	<nav class="sections" aria-label="Review workspaces">{#each sections as section}<button type="button" class:active={active === section.id} aria-pressed={active === section.id} aria-controls={`workspace-${section.id}`} onclick={() => active = section.id}>{section.label}</button>{/each}</nav>
	<div class="workspace-and-guide" class:with-guide={showGuide}>
		<div class="tool-panels">
			<section id="workspace-report" hidden={active !== 'report'} aria-label="Report QC workspace"><ReportWorkspace bind:this={reportWorkspace} /></section>
			<section id="workspace-fish" hidden={active !== 'fish'} aria-label="FISH construction workspace"><FishBuilder onuse={useFishNotation} /></section>
			<section id="workspace-cnv" hidden={active !== 'cnv'} aria-label="CNV evidence workspace"><CnvWorksheet /></section>
		</div>
		{#if showGuide}<div class="guide-column"><ReviewGuide slug={guideSlug} /></div>{/if}
	</div>
</div>

<style>
	.review-page { padding-block: 3rem 4rem; }
	.page-heading { max-width: 850px; }
	.page-heading h1 { font-size: clamp(2rem, 4vw, 3rem); }
	.page-heading > p:last-child { max-width: 70ch; font-size: .98rem; }
	.privacy-note { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; padding-block: .8rem; border-block: 1px solid var(--color-border); font-size: .77rem; color: var(--color-text-muted); margin-top: 1.5rem; }
	.privacy-note p { margin: 0; }
	.guide-toggle { flex-shrink: 0; background: none; border: 0; color: var(--color-primary); text-decoration: underline; text-underline-offset: .2em; padding: .5rem 0; font-size: .8rem; }
	.workspace-and-guide { display: grid; grid-template-areas: 'tools'; gap: 1.5rem; align-items: start; }
	.workspace-and-guide.with-guide { grid-template-areas: 'tools guide'; grid-template-columns: minmax(0, 1fr) minmax(290px, 340px); --review-workspace-columns: 1fr; }
	.tool-panels { grid-area: tools; min-width: 0; }
	.guide-column { grid-area: guide; min-width: 0; align-self: stretch; }
	.sections { display: flex; flex-wrap: wrap; gap: .5rem; margin-block: 1.5rem; }
	.sections button { color: var(--color-text-muted); background: transparent; border: 1px solid transparent; border-radius: 6px; font-size: .85rem; padding: .75rem 1rem; min-height: 44px; }
	.sections button.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }
	.sections button:not(.active):hover { background: #e8f0f5; }
	@media (max-width: 900px) { .workspace-and-guide.with-guide { grid-template-areas: 'guide' 'tools'; grid-template-columns: 1fr; } }
	@media (max-width: 640px) { .review-page { padding-top: 2rem; } .privacy-note { display: block; } .guide-toggle { margin-top: .25rem; } .sections { gap: .2rem; } .sections button { padding-inline: .7rem; font-size: .79rem; } }
</style>
