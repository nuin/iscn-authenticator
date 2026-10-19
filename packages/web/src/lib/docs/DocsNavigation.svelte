<script lang="ts">
	import { page } from '$app/state';
	import { searchGuides } from './index.js';

	let query = $state('');
	const matches = $derived(searchGuides(query));
	const groups = ['Review notation', 'Set up your workflow'] as const;
</script>

<div class="docs-navigation">
	<a class="docs-home" href="/docs" aria-current={page.url.pathname === '/docs' ? 'page' : undefined}>Documentation</a>
	<label for="guide-search">Search guides</label>
	<input id="guide-search" type="search" bind:value={query} placeholder="Try “mosaic” or “API”" />
	{#if query.trim()}
		<p class="search-status" role="status">{matches.length} {matches.length === 1 ? 'guide' : 'guides'} found</p>
	{/if}
	<nav aria-label="Documentation guides">
		{#each groups as group}
			{@const groupGuides = matches.filter((guide) => guide.group === group)}
			{#if groupGuides.length}
				<div class="nav-group">
					<p class="group-label">{group}</p>
					<ul>
						{#each groupGuides as guide}
							<li><a href={`/docs/${guide.slug}`} aria-current={page.url.pathname === `/docs/${guide.slug}` ? 'page' : undefined}>{guide.title}</a></li>
						{/each}
					</ul>
				</div>
			{/if}
		{/each}
		{#if !matches.length}
			<p class="empty-search">No guides match. Try a shorter term, such as “keys” or “coverage”.</p>
		{/if}
	</nav>
	<a class="workspace-link" href="/validate">Open the validator</a>
</div>

<style>
	.docs-navigation { position: sticky; top: 6rem; }
	.docs-home { display: inline-block; margin-bottom: 1.5rem; font-size: 1.05rem; font-weight: 700; color: var(--color-text); text-decoration: none; }
	label { display: block; margin-bottom: 0.5rem; color: var(--color-text-muted); font-size: 0.85rem; font-weight: 600; }
	input { box-sizing: border-box; width: 100%; padding: 0.75rem; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text); font: inherit; font-size: 0.9rem; }
	input:focus-visible { outline: 3px solid var(--color-primary); outline-offset: 3px; }
	.search-status, .empty-search { font-size: 0.85rem; color: var(--color-text-muted); }
	.nav-group { margin-top: 1.75rem; }
	.group-label { margin: 0 0 0.6rem; font-size: 0.8rem; font-weight: 700; color: var(--color-text-muted); }
	ul { list-style: none; margin: 0; padding: 0; }
	li + li { margin-top: 0.2rem; }
	li a { display: block; padding: 0.55rem 0.7rem; border-left: 2px solid transparent; color: var(--color-text-muted); text-decoration: none; font-size: 0.9rem; line-height: 1.45; }
	li a:hover { color: var(--color-primary); background: #edf4f8; }
	li a[aria-current='page'] { border-color: var(--color-primary); background: #e4f2f5; color: var(--color-primary); font-weight: 600; }
	.workspace-link { display: inline-block; margin-top: 1.75rem; font-size: 0.9rem; font-weight: 600; }
	@media (max-width: 760px) {
		.docs-navigation { position: static; }
		nav { display: grid; grid-template-columns: 1fr 1fr; gap: 0 1rem; }
		.docs-home { margin-bottom: 1rem; }
		.nav-group { margin-top: 1rem; }
		li a { padding: 0.5rem; }
		.workspace-link { margin-top: 1rem; }
	}
</style>
