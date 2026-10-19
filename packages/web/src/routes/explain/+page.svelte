<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let search = $state('');
	const filtered = $derived(data.examples.filter((entry) => `${entry.signature} ${entry.title} ${entry.category}`.toLowerCase().includes(search.trim().toLowerCase())));
</script>
<svelte:head><title>Notation examples · ISCN Authenticator</title><meta name="description" content="Explore worked karyotype notation examples, then open them in the validator to inspect their parsed structure." /></svelte:head>
<div class="page-shell library-page">
	<header class="page-heading"><p class="section-label">Example library</p><h1>Get to know<br />the notation.</h1><p>Explore a few familiar patterns. Each example connects the notation to the fields you can inspect in the workspace.</p></header>
	<div class="library-toolbar"><label for="example-search">Find an example</label><input id="example-search" type="search" bind:value={search} placeholder="Try chromosome 21 or translocation" /><span role="status">{filtered.length} {filtered.length === 1 ? 'example' : 'examples'}</span></div>
	<div class="example-grid">
		{#each filtered as entry}
			<a class="example-card" href="/explain/{encodeURIComponent(entry.signature)}"><span class="category">{entry.category}</span><code>{entry.signature}</code><h2>{entry.title}</h2><p>{entry.description}</p><span class="read-example">Explore this notation</span></a>
		{:else}<div class="empty"><h2>No matching examples</h2><p>Try a chromosome number or a term such as deletion.</p><button class="button secondary" onclick={() => search = ''}>Show all examples</button></div>{/each}
	</div>
	<p class="library-note">These are curated notation examples. They do not define the full validation scope or provide a clinical interpretation. <a href="/docs/coverage">Read the coverage guide.</a></p>
</div>
<style>
	.library-page { padding-block: 4rem 5rem; }
	.page-heading { max-width: 700px; margin-bottom: 2.5rem; }
	.library-toolbar { display: grid; grid-template-columns: max-content minmax(200px, 440px) 1fr; align-items: center; gap: 1.5rem; padding-block: 1.5rem; margin-bottom: 1rem; border-block: 1px solid var(--color-border); }
	.library-toolbar label { font-size: .8rem; font-weight: 600; }
	.library-toolbar input { padding: .7rem .9rem; border: 1px solid #a7bdcc; border-radius: 6px; min-width: 0; font-size: .8rem; color: var(--color-text); background: white; }
	.library-toolbar > span { text-align: right; font-size: .75rem; color: var(--color-text-muted); }
	.example-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; padding-block: 1rem; }
	.example-card { display: flex; flex-direction: column; padding: 1.7rem; border: 1px solid var(--color-border); background: white; border-radius: 10px; text-decoration: none; color: var(--color-text); }
	.example-card:hover { border-color: #8ab4c2; background: #fcfeff; }
	.category { font-size: .7rem; color: var(--color-text-muted); margin-bottom: 1.8rem; }
	.example-card code { font-size: .9rem; color: var(--color-primary); overflow-wrap: anywhere; }
	.example-card h2 { font-size: 1.05rem; line-height: 1.4; margin: 1rem 0; }
	.example-card p { font-size: .8rem; line-height: 1.8; color: var(--color-text-muted); flex: 1; }
	.read-example { font-size: .75rem; color: var(--color-primary); margin-top: 1.5rem; text-decoration: underline; text-underline-offset: 4px; }
	.empty { padding: 2rem 0; grid-column: 1/-1; }.empty p { color: var(--color-text-muted); }
	.library-note { font-size: .8rem; color: var(--color-text-muted); margin-top: 2rem; line-height: 1.8; }
	@media (max-width: 960px) { .example-grid { grid-template-columns: 1fr 1fr; } }
	@media (max-width: 600px) { .library-page { padding-top: 2.5rem; } .example-grid { grid-template-columns: 1fr; } .library-toolbar { grid-template-columns: 1fr auto; gap: .75rem; } .library-toolbar input { grid-column: 1/-1; grid-row: 2; } }
</style>
