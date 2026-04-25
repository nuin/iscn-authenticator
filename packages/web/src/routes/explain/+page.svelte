<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<h2>Curated ISCN Explanations</h2>
<p>A library of human-curated explanations for common ISCN 2024 karyotype strings.</p>

<ul class="explain-list">
	{#each data.signatures as sig}
		<li>
			<a href="/explain/{encodeURIComponent(sig)}">{sig}</a>
		</li>
	{/each}
</ul>

<style>
	.explain-list {
		margin-top: 2rem;
		list-style: none;
		padding: 0;
	}

	.explain-list li {
		margin-bottom: 0.75rem;
	}

	.explain-list a {
		font-family: var(--font-mono);
		text-decoration: none;
		font-size: 1.1rem;
	}

	.explain-list a:hover {
		text-decoration: underline;
	}
</style>
