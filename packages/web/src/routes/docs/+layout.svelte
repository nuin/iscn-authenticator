<script lang="ts">
	import type { Snippet } from 'svelte';
	import DocsNavigation from '#lib/docs/DocsNavigation.svelte';
	let { children }: { children: Snippet } = $props();
</script>

<div class="page-shell docs-shell">
	<aside class="docs-sidebar"><DocsNavigation /></aside>
	<div class="docs-main">{@render children()}</div>
</div>

<style>
	.docs-shell { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 4rem; padding-top: 3rem; padding-bottom: 5rem; }
	.docs-sidebar { min-width: 0; }
	.docs-main { min-width: 0; }
	@media (max-width: 1000px) { .docs-shell { grid-template-columns: 210px minmax(0, 1fr); gap: 2.5rem; } }
	@media (max-width: 760px) { .docs-shell { grid-template-columns: 1fr; gap: 2rem; padding-top: 1.5rem; } .docs-sidebar { padding-bottom: 1.5rem; border-bottom: 1px solid var(--color-border); } }
</style>
