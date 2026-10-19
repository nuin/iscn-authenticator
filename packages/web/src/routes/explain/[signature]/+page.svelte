<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>
<svelte:head><title>{data.example.title} · ISCN Authenticator</title><meta name="description" content={data.example.description} /></svelte:head>
<div class="page-shell example-page">
	<nav aria-label="Breadcrumb"><a href="/explain">Example library</a><span aria-hidden="true">/</span><span>{data.example.category}</span></nav>
	<header class="page-heading"><p class="section-label">Curated notation walkthrough</p><h1>{data.example.title}</h1></header>
	<section class="notation-panel"><p>The notation</p><code>{data.signature}</code></section>
	<div class="example-content"><section><h2>Reading this example</h2><p>{data.example.description}</p><p>Open the full example to inspect its chromosome count, sex chromosome notation and parsed abnormalities. The workspace identifies any coverage limits separately from issues found by the engine.</p><a href="/validate?karyotype={encodeURIComponent(data.example.full)}" class="button">Open in the validator</a>{#if data.signature !== data.example.full}<p class="context-note">This fragment is placed in an illustrative <code>46,XX</code> karyotype for the workspace.</p>{/if}</section><aside class="panel"><h2>Continue your review</h2><a href="/docs/reading-results">Reading a result</a><a href="/docs/coverage">Coverage and limitations</a><a href="/docs/batch">Reviewing multiple entries</a><p>Example notes explain notation. They are not a patient-specific interpretation.</p></aside></div>
	{#if data.entry.refs?.omim?.length}<section class="background"><h2>Background resources</h2><p>The source example library links to these OMIM entries. Consult the original resources for their scope and context.</p><ul>{#each data.entry.refs.omim as id}<li><a href="https://omim.org/entry/{id}" target="_blank" rel="noreferrer">OMIM {id} <span class="sr-only">(opens in a new tab)</span></a></li>{/each}</ul></section>{/if}
</div>
<style>
	.example-page { max-width: 1040px; padding-block: 3rem 5rem; }
	nav { display: flex; flex-wrap: wrap; gap: .7rem; font-size: .75rem; color: var(--color-text-muted); margin-bottom: 3rem; }
	.page-heading { max-width: 760px; }
	.notation-panel { padding: 1.8rem 2rem; background: #eaf3f7; border-block: 1px solid #cadde6; margin-block: 2rem 3rem; }
	.notation-panel p { font-size: .75rem; color: var(--color-text-muted); margin-bottom: .6rem; }
	.notation-panel code { font-size: clamp(1.2rem, 3.5vw, 2rem); color: var(--color-primary); overflow-wrap: anywhere; }
	.example-content { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 4rem; }
	h2 { font-size: 1.15rem; }.example-content p, .background p { color: var(--color-text-muted); font-size: .9rem; line-height: 1.85; }
	.example-content .button { margin-top: 1rem; }.example-content .context-note { font-size: .75rem; margin-top: 1rem; }
	aside { padding: 1.5rem; align-self: start; }aside h2 { font-size: .9rem; }aside a { display: block; margin-block: .75rem; font-size: .8rem; }aside p { border-top: 1px solid var(--color-border); padding-top: 1rem; margin-bottom: 0; font-size: .75rem !important; }
	.background { margin-top: 3rem; border-top: 1px solid var(--color-border); padding-top: 2rem; }.background ul { padding-left: 1.2rem; font-size: .85rem; }
	@media (max-width: 700px) { .example-content { grid-template-columns: 1fr; gap: 2rem; }.notation-panel { padding: 1.5rem; }.example-page { padding-top: 2rem; } }
</style>
