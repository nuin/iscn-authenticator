<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<nav class="breadcrumb">
	<a href="/explain">&larr; All Explanations</a>
</nav>

<h2 class="mono">{data.signature}</h2>

<div class="explain-card">
	<p class="summary"><strong>{data.entry.summary}</strong></p>
	<p class="detail">{data.entry.detail}</p>
	{#if data.entry.citation}
		<p class="citation">
			<em>Source: ISCN 2024 § {data.entry.citation.section}{data.entry.citation.page ? `, p. ${data.entry.citation.page}` : ''}</em>
		</p>
	{/if}
</div>

{#if data.entry.refs}
	<div class="references">
		<h3>References</h3>
		<ul>
			{#if data.entry.refs.omim}
				{#each data.entry.refs.omim as id}
					<li>OMIM: <a href="https://omim.org/entry/{id}" target="_blank">{id}</a></li>
				{/each}
			{/if}
			{#if data.entry.refs.hpo}
				{#each data.entry.refs.hpo as id}
					<li>HPO: <a href="https://hpo.jax.org/app/browse/term/{id}" target="_blank">{id}</a></li>
				{/each}
			{/if}
		</ul>
	</div>
{/if}

<div class="actions">
	<a href="/?karyotype={encodeURIComponent(data.signature)}" class="btn btn-primary">
		Validate this Karyotype
	</a>
</div>

<style>
	.breadcrumb {
		margin-bottom: 2rem;
	}

	.breadcrumb a {
		color: var(--color-text-muted);
		text-decoration: none;
		font-size: 0.9rem;
	}

	.mono {
		font-family: var(--font-mono);
	}

	.explain-card {
		margin: 2rem 0;
		padding: 2rem;
		background: var(--color-bg);
		border-radius: var(--radius);
	}

	.summary {
		font-size: 1.25rem;
		margin-bottom: 1.5rem;
	}

	.detail {
		line-height: 1.7;
		margin-bottom: 1.5rem;
	}

	.citation {
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}

	.references h3 {
		font-size: 1rem;
		margin-bottom: 0.5rem;
	}

	.references ul {
		list-style: none;
		padding: 0;
	}

	.references li {
		font-size: 0.9rem;
		margin-bottom: 0.25rem;
	}

	.actions {
		margin-top: 3rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--color-border);
	}

	.btn {
		display: inline-block;
		background: var(--color-primary);
		color: white;
		padding: 0.75rem 1.5rem;
		border-radius: 4px;
		text-decoration: none;
		font-weight: 500;
	}
</style>
