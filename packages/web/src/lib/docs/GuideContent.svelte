<script lang="ts">
	import type { Guide } from './types.js';
	let { guide }: { guide: Guide } = $props();
</script>

<article>
	<header class="page-heading guide-heading">
		<p class="section-label">{guide.group}</p>
		<h1>{guide.title}</h1>
		<p>{guide.description}</p>
	</header>
	<nav class="on-this-page" aria-label="On this page">
		<p>On this page</p>
		<ul>
			{#each guide.sections as section}
				<li><a href={`#${section.id}`}>{section.title}</a></li>
			{/each}
		</ul>
	</nav>
	{#each guide.sections as section}
		<section id={section.id}>
			<h2>{section.title}</h2>
			{#each section.paragraphs ?? [] as paragraph}<p>{paragraph}</p>{/each}
			{#if section.steps}
				<ol>{#each section.steps as step}<li>{step}</li>{/each}</ol>
			{/if}
			{#if section.items}
				<ul>{#each section.items as item}<li>{item}</li>{/each}</ul>
			{/if}
			{#if section.table}
				<div class="table-scroll" role="region" aria-label={`${section.title} reference table`}>
					<table>
						<thead><tr>{#each section.table.headings as heading}<th scope="col">{heading}</th>{/each}</tr></thead>
						<tbody>{#each section.table.rows as row}<tr>{#each row as cell, index}{#if index === 0}<th scope="row">{cell}</th>{:else}<td>{cell}</td>{/if}{/each}</tr>{/each}</tbody>
					</table>
				</div>
			{/if}
			{#if section.code}
				<figure class="code-example">
					<figcaption>{section.code.label}</figcaption>
					<pre aria-label={section.code.label}><code>{section.code.value}</code></pre>
				</figure>
			{/if}
			{#if section.note}<aside class="notice">{section.note}</aside>{/if}
			{#if section.links}
				<ul class="related-links">{#each section.links as link}<li><a href={link.href}>{link.label}</a></li>{/each}</ul>
			{/if}
		</section>
	{/each}
	<footer class="guide-footer"><a href="/docs">All documentation</a><a href="/validate">Open the validator</a></footer>
</article>

<style>
	article { min-width: 0; max-width: 810px; }
	.guide-heading { margin-bottom: 2rem; }
	.guide-heading h1 { max-width: 18ch; font-size: clamp(2rem, 4vw, 3.1rem); line-height: 1.12; }
	.guide-heading > p:last-child { max-width: 58ch; }
	.on-this-page { padding: 1.25rem 1.5rem; border-left: 3px solid var(--color-primary); background: var(--color-surface); }
	.on-this-page p { margin: 0 0 0.5rem; font-size: 0.85rem; font-weight: 700; }
	.on-this-page ul { list-style: none; margin: 0; padding: 0; }
	.on-this-page li { margin: 0.35rem 0; font-size: 0.9rem; }
	section { margin-top: 3rem; scroll-margin-top: 7rem; }
	h2 { font-size: 1.45rem; line-height: 1.3; letter-spacing: -0.02em; margin-bottom: 1rem; }
	section p, section li { line-height: 1.75; }
	section p { max-width: 72ch; color: var(--color-text-muted); }
	section li + li { margin-top: 0.6rem; }
	section ul, section ol { padding-left: 1.4rem; }
	.table-scroll { max-width: 100%; overflow-x: auto; margin: 1.25rem 0; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); }
	table { width: 100%; border-collapse: collapse; font-size: 0.9rem; line-height: 1.6; }
	th, td { padding: 1rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--color-border); }
	thead th { background: #edf4f8; color: var(--color-text); font-weight: 600; }
	tbody th { width: 28%; min-width: 130px; font-weight: 600; }
	td { color: var(--color-text-muted); min-width: 180px; }
	tr:last-child th, tr:last-child td { border-bottom: 0; }
	.code-example { min-width: 0; margin: 1.5rem 0; border-radius: 8px; overflow: hidden; background: #142b3f; }
	figcaption { padding: 0.8rem 1.25rem; background: #203c51; color: #d8e3ec; font-size: 0.8rem; }
	pre { margin: 0; padding: 1.25rem; overflow-x: auto; color: #f6f9fc; font: 0.85rem/1.7 var(--font-mono); }
	code { font: inherit; }
	.notice { margin-top: 1.5rem; font-size: 0.9rem; line-height: 1.65; }
	section .related-links { display: flex; flex-wrap: wrap; gap: 0.7rem 1.5rem; list-style: none; padding: 0; margin-top: 1.5rem; font-size: 0.9rem; }
	section .related-links li { margin: 0; }
	.guide-footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1rem; margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--color-border); font-size: 0.9rem; }
	@media (max-width: 760px) { section { margin-top: 2.25rem; } .on-this-page { padding: 1rem; } }
</style>
