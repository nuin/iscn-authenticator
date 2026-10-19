<script lang="ts">
	import { guides } from '#lib/docs/index.js';
	const groups = ['Review notation', 'Set up your workflow'] as const;
</script>

<svelte:head>
	<title>Documentation | ISCN Authenticator</title>
	<meta name="description" content="Practical guides to checking karyotype notation, understanding coverage, batch review, accounts, and integration." />
</svelte:head>

<header class="page-heading">
	<p class="section-label">Documentation</p>
	<h1>A clear path from notation to review.</h1>
	<p>Start with a browser check, understand what the result covers, then fit the tool into your laboratory’s workflow.</p>
</header>

<div class="start-guide panel">
	<div><h2>New to the workspace?</h2><p>Check an example and learn how to read the result.</p></div>
	<a class="button" href="/docs/getting-started">Start here</a>
</div>

{#each groups as group}
	<section aria-label={group}>
		<h2>{group}</h2>
		<div class="guide-list">
			{#each guides.filter((guide) => guide.group === group) as guide}
				<a class="guide-link" href={`/docs/${guide.slug}`}>
					<h3>{guide.title}</h3>
					<p>{guide.description}</p>
				</a>
			{/each}
		</div>
	</section>
{/each}

<aside class="notice">
	<strong>Know the boundary of a check.</strong>
	The validator applies implemented rules. It does not establish complete ISCN conformity.
	<a href="/docs/coverage">Read the coverage limits</a> before using results in your workflow.
</aside>

<style>
	.page-heading h1 { max-width: 18ch; font-size: clamp(2.2rem, 4vw, 3.5rem); line-height: 1.12; }
	.page-heading > p:last-child { max-width: 60ch; }
	.start-guide { display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; margin: 2rem 0 3rem; padding: 1.5rem; background: #e4f2f5; }
	.start-guide h2 { margin: 0; font-size: 1.15rem; }
	.start-guide p { margin: 0.4rem 0 0; color: var(--color-text-muted); font-size: 0.9rem; }
	.start-guide .button { flex-shrink: 0; }
	section { margin: 2.5rem 0; }
	section > h2 { margin-bottom: 1rem; font-size: 1rem; font-weight: 600; color: var(--color-text-muted); }
	.guide-list { border-top: 1px solid var(--color-border); }
	.guide-link { display: block; padding: 1.3rem 0; border-bottom: 1px solid var(--color-border); text-decoration: none; }
	.guide-link h3 { margin: 0 0 0.4rem; font-size: 1.1rem; font-weight: 600; color: var(--color-primary); }
	.guide-link p { margin: 0; font-size: 0.9rem; line-height: 1.6; color: var(--color-text-muted); }
	.guide-link:hover h3 { text-decoration: underline; }
	.notice { font-size: 0.9rem; line-height: 1.7; }
	@media (max-width: 500px) { .start-guide { align-items: flex-start; flex-direction: column; } }
</style>
