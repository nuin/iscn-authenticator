<script lang="ts">
	import type { ReportInput, ReportReview } from '#lib/review/types.ts';
	let { input, review }: { input: ReportInput; review: ReportReview } = $props();
	const comparisonGroups = ['added', 'removed', 'retained'] as const;
	const groupLabels = { added: 'Added', removed: 'Removed', retained: 'Retained' };
	const tone = $derived(review.status === 'Issues found' ? 'issues' : review.status === 'Review required' ? 'attention' : 'passed');
	const percentage = (value: number | null) => value === null ? 'Not calculated' : `${Number(value.toFixed(2))}%`;
</script>

<section class="panel result" aria-labelledby="report-status-heading">
	<header class={tone}><p>Report QC result</p><h2 id="report-status-heading">{review.status}</h2></header>
	<div class="content">
		<p class="notation-label">Current notation, as entered</p><pre class="notation">{input.notation}</pre>
		{#if review.issues.length}
			<section class="issue-list" aria-label="Report checks requiring attention"><h3>Details to review</h3><ul>{#each review.issues as issue}<li><strong>{issue.severity === 'error' ? 'Issue' : 'Review'}: {issue.message}</strong><small><code>{issue.code}</code> · Reference: <a href="/docs/review-references" target="_blank" rel="noopener noreferrer">{issue.reference} (opens a new tab)</a></small></li>{/each}</ul></section>
		{/if}
		<section class="counts" aria-labelledby="cell-count-heading">
			<div class="section-heading"><h3 id="cell-count-heading">Cell line counts</h3><p>{review.totalCells === null ? 'Total not established' : `${review.totalCells} cells in notation`}</p></div>
			{#if review.lines.length}
				<div class="table-scroll"><table aria-label="Cell line counts"><thead><tr><th scope="col">Cell line</th><th scope="col">Cells</th><th scope="col">Share</th></tr></thead><tbody>{#each review.lines as line}<tr><th scope="row"><code>{line.label}</code>{#if line.isDonor}<span class="donor">Donor group</span>{/if}</th><td>{line.count ?? 'Not stated'}</td><td>{percentage(line.percentage)}</td></tr>{/each}</tbody></table></div>
			{:else}<p class="help">No cell-line counts are available for this notation.</p>{/if}
			<p class="help">Percentages describe the counted cells in the notation; they do not establish specimen-wide prevalence.</p>
		</section>
		{#if review.comparison}
			<section class="comparison" aria-labelledby="comparison-heading">
				<h3 id="comparison-heading">Changes in listed findings</h3><p class="help">Previous notation status: {review.comparison.previousStatus}. This comparison does not infer biological clone identity, progression or response.</p>
				<pre class="notation previous">{input.previousNotation}</pre>
				<div class="comparison-groups">{#each comparisonGroups as group}<section aria-label={`${groupLabels[group]} findings`}><h4>{groupLabels[group]}</h4>{#if review.comparison[group].length}<ul>{#each review.comparison[group] as finding}<li><code>{finding}</code></li>{/each}</ul>{:else}<p>None listed</p>{/if}</section>{/each}</div>
			</section>
		{/if}
		<details class="checks" open><summary>Checks performed</summary><dl>{#each review.checks as check}<dt>{check.name}</dt><dd>{check.outcome}</dd>{/each}</dl></details>
		<details class="raw"><summary>Raw notation check result</summary><pre>{JSON.stringify(review.validation.result, null, 2)}</pre></details>
		<p class="help scope">This is a bounded notation and consistency review. It does not certify full ISCN compliance or provide a clinical interpretation. <a href="/docs/report-review" target="_blank" rel="noopener noreferrer">Review scope and reference details (opens a new tab)</a>.</p>
	</div>
</section>

<style>
	.result { overflow: hidden; }
	header { padding: 1.3rem 1.5rem; border-bottom: 1px solid var(--color-border); background: #eef8f7; }
	header.issues { background: #fff2f0; }
	header.attention { background: #fff8e9; }
	header p { font-size: .78rem; margin-bottom: .35rem; }
	h2 { font-size: 1.5rem; margin: 0; }
	.content { padding: 1.5rem; }
	h3 { font-size: .95rem; margin-bottom: .65rem; }
	.notation-label { font-size: .75rem; color: var(--color-text-muted); margin-bottom: .4rem; }
	.notation { white-space: pre-wrap; overflow-wrap: anywhere; font-size: .83rem; background: var(--color-bg); padding: .9rem; border-radius: 6px; margin: 0 0 1.5rem; }
	.issue-list { margin-bottom: 1.5rem; }
	ul { padding-left: 1.2rem; margin-block: .7rem; }
	li { font-size: .8rem; line-height: 1.7; margin-bottom: .7rem; }
	li strong { font-weight: 500; }
	li small { display: block; color: var(--color-text-muted); margin-top: .3rem; overflow-wrap: anywhere; }
	.section-heading { display: flex; justify-content: space-between; align-items: baseline; gap: .5rem; flex-wrap: wrap; }
	.section-heading p { font-size: .76rem; color: var(--color-text-muted); }
	.table-scroll { overflow-x: auto; }
	table { border-collapse: collapse; width: 100%; font-size: .79rem; }
	th, td { padding: .65rem .45rem; text-align: left; border-bottom: 1px solid var(--color-border); vertical-align: top; }
	thead th { font-weight: 600; color: var(--color-text-muted); }
	tbody th { font-weight: 400; overflow-wrap: anywhere; }
	.donor { display: block; font-size: .7rem; color: var(--color-text-muted); }
	.help { font-size: .76rem; color: var(--color-text-muted); line-height: 1.7; margin-block: .8rem 0; }
	.comparison { margin-block: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--color-border); }
	.previous { margin-block: .75rem; }
	.comparison-groups { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; }
	h4 { font-size: .8rem; margin: .4rem 0; }
	.comparison-groups p { font-size: .75rem; color: var(--color-text-muted); margin: 0; }
	.comparison-groups li { overflow-wrap: anywhere; }
	details { border-top: 1px solid var(--color-border); padding-top: 1rem; margin-top: 1.3rem; }
	summary { cursor: pointer; font-size: .8rem; font-weight: 600; }
	dl { font-size: .77rem; line-height: 1.7; margin-bottom: 0; }
	dt { font-weight: 600; margin-top: .7rem; }
	dd { margin-left: 0; color: var(--color-text-muted); }
	.raw pre { font-size: .72rem; }
	.scope { border-top: 1px solid var(--color-border); margin-top: 1.3rem; padding-top: 1rem; }
	@media (max-width: 480px) { .content, header { padding: 1.1rem; } .comparison-groups { grid-template-columns: 1fr; gap: .5rem; } }
</style>
