<script lang="ts">
	import { guides } from '#lib/docs/index.js';
	let { slug }: { slug: string } = $props();
	let selected = $state('report-review');
	let content = $state<HTMLDivElement>();
	$effect(() => { selected = slug; });
	const guide = $derived(guides.find((entry) => entry.slug === selected));
</script>

<aside id="workspace-documentation" class="panel guide" aria-label="Workspace documentation">
	<div class="guide-header"><div class="field"><label for="documentation-guide">Documentation guide</label><select id="documentation-guide" bind:value={selected}>{#each guides as entry}<option value={entry.slug}>{entry.title}</option>{/each}</select></div><p>Your entries stay available while you read. Reference links open in a new tab.</p><button class="read-guide" type="button" onclick={() => content?.focus()}>Read guide content</button></div>
	{#if guide}
		<div class="guide-content" bind:this={content} tabindex="-1" role="region" aria-label={`${guide.title} content`}>
			<h2>{guide.title}</h2><p>{guide.description}</p>
			{#each guide.sections as section}
				<section aria-labelledby={`review-guide-${section.id}`}>
					<h3 id={`review-guide-${section.id}`}>{section.title}</h3>
					{#each section.paragraphs ?? [] as paragraph}<p>{paragraph}</p>{/each}
					{#if section.steps}<ol>{#each section.steps as step}<li>{step}</li>{/each}</ol>{/if}
					{#if section.items}<ul>{#each section.items as item}<li>{item}</li>{/each}</ul>{/if}
					{#if section.table}<div class="reference-table"><table><thead><tr>{#each section.table.headings as heading}<th scope="col">{heading}</th>{/each}</tr></thead><tbody>{#each section.table.rows as row}<tr>{#each row as cell, index}{#if index === 0}<th scope="row">{cell}</th>{:else}<td>{cell}</td>{/if}{/each}</tr>{/each}</tbody></table></div>{/if}
					{#if section.code}<figure><figcaption>{section.code.label}</figcaption><pre>{section.code.value}</pre></figure>{/if}
					{#if section.note}<p class="notice">{section.note}</p>{/if}
					{#if section.links}<ul class="links">{#each section.links as link}<li><a href={link.href} target="_blank" rel="noopener noreferrer">{link.label}<span class="sr-only"> (opens a new tab)</span></a></li>{/each}</ul>{/if}
				</section>
			{/each}
			<a class="full-guide" href={`/docs/${guide.slug}`} target="_blank" rel="noopener noreferrer">Open full guide (opens a new tab)</a>
		</div>
	{/if}
</aside>

<style>
	.guide { position: sticky; top: 1rem; min-width: 0; overflow: hidden; }
	.guide-header { padding: 1.1rem; border-bottom: 1px solid var(--color-border); background: #eef7fa; }
	.field { margin-bottom: .65rem; }
	.field select { font-size: .78rem; padding: .65rem; }
	.guide-header p { font-size: .72rem; color: var(--color-text-muted); margin: 0; line-height: 1.6; }
	.read-guide { background: transparent; border: 0; color: var(--color-primary); font-size: .75rem; padding: .5rem 0 0; text-decoration: underline; text-underline-offset: .2em; }
	.guide-content { padding: 1.1rem; max-height: 72vh; overflow: auto; overflow-wrap: anywhere; }
	h2 { font-size: 1.15rem; margin-bottom: .8rem; }
	h3 { font-size: .9rem; margin-bottom: .75rem; }
	section { padding-top: 1.2rem; margin-top: 1.2rem; border-top: 1px solid var(--color-border); }
	p, li { font-size: .77rem; line-height: 1.75; color: var(--color-text-muted); }
	ol, ul { padding-left: 1.2rem; }
	li + li { margin-top: .5rem; }
	.reference-table { margin-block: 1rem; }
	table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: .73rem; line-height: 1.65; }
	th, td { padding: .5rem; border: 1px solid var(--color-border); text-align: left; vertical-align: top; }
	td { color: var(--color-text-muted); }
	figure { margin: 1rem 0; }
	figcaption { font-size: .72rem; font-weight: 600; line-height: 1.6; margin-bottom: .5rem; }
	pre { background: var(--color-bg); font-size: .72rem; padding: .75rem; border-radius: 5px; white-space: pre-wrap; overflow-wrap: anywhere; }
	.notice { padding: .8rem; }
	.links { list-style: none; padding: 0; }
	.full-guide { display: inline-block; font-size: .75rem; margin-top: 1rem; }
	@media (max-width: 900px) { .guide { position: static; } .guide-content { max-height: 55vh; } }
</style>
