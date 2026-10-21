<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	const dateFormat = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
</script>

<svelte:head><title>Workspace · ISCN Authenticator</title></svelte:head>

<header class="page-heading">
	<p class="section-label">Workspace overview</p>
	<h1>Ready for your next review.</h1>
	<p>Check notation, work through a batch, and keep the results you need.</p>
</header>

<div class="workflow-grid">
	<a class="panel workflow primary-workflow" href="/validate">
		<span class="section-label">One karyotype</span>
		<h2>Open the validator <span aria-hidden="true">↗</span></h2>
		<p>Review syntax, inspect the parsed result, and see which checks are covered.</p>
		<span class="workflow-footer">No karyotype is sent for validation</span>
	</a>
	<a class="panel workflow" href="/dashboard/batch">
		<span class="section-label">Up to 500 rows</span>
		<h2>Start a batch review <span aria-hidden="true">→</span></h2>
		<p>Check one karyotype per line and download a CSV or JSON result file.</p>
		<span class="workflow-footer">Available with your account</span>
	</a>
</div>

<p><a href="/dashboard/api">Connect a laboratory system with the hosted API →</a></p>

<section class="account-section" aria-labelledby="account-heading">
	<div class="section-heading"><h2 id="account-heading">Your account</h2><a href="/dashboard/keys">Account access <span aria-hidden="true">→</span></a></div>
	<dl class="panel account-facts">
		<div><dt>Sign-in method</dt><dd class="date-value">Email code<span>Email ownership verified</span></dd></div>
		<div><dt>Account plan</dt><dd class="plan-value">{data.user.plan}<a href="/dashboard/billing">Billing details</a></dd></div>
		<div><dt>Account created</dt><dd class="date-value">{dateFormat.format(new Date(data.user.created_at * 1000))}<span>UTC</span></dd></div>
	</dl>
</section>

<section class="panel review-note" aria-labelledby="review-note-heading">
	<div class="note-icon" aria-hidden="true">i</div>
	<div><h2 id="review-note-heading">Keep your review context</h2><p>Browser results are not saved to this account. Download anything you need before leaving a review. Validation covers implemented rules and does not replace expert assessment.</p><a href="/docs/data-handling">Understand data handling <span aria-hidden="true">→</span></a></div>
</section>

<style>
	.workflow-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
	.workflow { display: flex; flex-direction: column; min-width: 0; padding: 1.75rem; text-decoration: none; color: var(--color-text); transition: border-color 150ms ease; }
	.workflow:hover { border-color: var(--color-primary); }
	.primary-workflow { border-top: 3px solid var(--color-primary); }
	.workflow h2 { display: flex; justify-content: space-between; gap: 0.5rem; font-size: 1.3rem; margin: 1rem 0; letter-spacing: -0.025em; }
	.workflow p { margin: 0 0 1.5rem; color: var(--color-text-muted); line-height: 1.65; font-size: 0.9rem; }
	.workflow-footer { margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--color-border); color: var(--color-primary); font-size: 0.75rem; font-weight: 600; }
	.account-section { margin-block: 2.5rem; }
	.section-heading { display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; margin-bottom: 1rem; }
	.section-heading h2 { font-size: 1.1rem; margin: 0; }
	.section-heading a { font-size: 0.8rem; }
	.account-facts { display: grid; grid-template-columns: 1fr 1fr 1.15fr; margin: 0; padding: 1.5rem 0; }
	.account-facts > div { padding: 0 1.5rem; min-width: 0; }
	.account-facts > div + div { border-left: 1px solid var(--color-border); }
	dt { color: var(--color-text-muted); font-size: 0.8rem; }
	dd { margin: 0.75rem 0 0; font-size: 2rem; font-weight: 600; }
	dd span, dd a { display: block; margin-top: 0.5rem; font-size: 0.75rem; font-weight: 400; color: var(--color-text-muted); }
	.plan-value { text-transform: capitalize; font-size: 1.6rem; }
	.plan-value a { text-transform: none; color: var(--color-primary); }
	.date-value { font-size: 1.1rem; padding-top: 0.6rem; }
	.review-note { display: flex; gap: 1rem; padding: 1.5rem; background: transparent; }
	.note-icon { flex-shrink: 0; width: 24px; height: 24px; display: grid; place-items: center; border: 1px solid var(--color-primary); color: var(--color-primary); border-radius: 50%; font-family: var(--font-mono); font-size: 0.8rem; }
	.review-note h2 { font-size: 0.95rem; margin: 0 0 0.5rem; }
	.review-note p { font-size: 0.85rem; line-height: 1.65; color: var(--color-text-muted); margin: 0 0 0.75rem; }
	.review-note a { font-size: 0.8rem; }
	@media (max-width: 600px) {
		.workflow-grid, .account-facts { grid-template-columns: 1fr; }
		.account-facts { padding: 0 1.5rem; }
		.account-facts > div { padding: 1.25rem 0; }
		.account-facts > div + div { border-left: 0; border-top: 1px solid var(--color-border); }
		.workflow { padding: 1.5rem; }
	}
</style>
