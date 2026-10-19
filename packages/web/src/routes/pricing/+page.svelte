<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Plans and availability · ISCN Authenticator</title>
	<meta name="description" content="Explore browser validation, account access, and current paid checkout availability for ISCN Authenticator." />
</svelte:head>

<div class="page-shell pricing-page">
	<header class="page-heading pricing-heading">
		<p class="section-label">Plans and availability</p>
		<h1>Start with the work<br />in front of you.</h1>
		<p>Review karyotype notation in your browser. Create an account when you are ready to work through a batch.</p>
	</header>

	<div class="access-grid">
		<section class="panel access-card" aria-labelledby="browser-heading">
			<p class="section-label">Open access</p>
			<h2 id="browser-heading">Browser review</h2>
			<p class="access-summary">A clear starting point for checking individual karyotypes.</p>
			<div class="access-price">Free <span>No account required</span></div>
			<ul><li>Individual karyotype validation</li><li>Parsed results and chromosome overview</li><li>Example explanations and coverage guides</li><li>Explicit result downloads</li></ul>
			<a href="/validate" class="button secondary">Open the validator <span aria-hidden="true">→</span></a>
		</section>
		<section class="panel access-card account-card" aria-labelledby="workspace-heading">
			<p class="section-label">With an account</p>
			<h2 id="workspace-heading">Your workspace</h2>
			<p class="access-summary">A place to review batches and manage your account access.</p>
			<div class="access-price">Free account <span>No payment details required</span></div>
			<ul><li>Batch review of up to 500 karyotypes</li><li>Row-level results and coverage notes</li><li>CSV and JSON batch downloads</li><li>Account key creation and revocation</li></ul>
			<a href={data.signedIn ? '/dashboard' : '/signup'} class="button">{data.signedIn ? 'Open your workspace' : 'Create an account'} <span aria-hidden="true">→</span></a>
		</section>
	</div>

	<section class="panel paid-availability" aria-labelledby="paid-heading">
		<div><p class="section-label">Paid availability</p><h2 id="paid-heading">{data.checkoutAvailable ? 'Review the current offering' : 'Paid checkout is not available yet'}</h2><p>{data.checkoutAvailable ? 'Review the configured price, billing interval, and purchase details in Stripe before confirming any payment.' : 'The browser tools above are available now. A paid offering and its price will be shown when checkout is available.'}</p></div>
		{#if data.checkoutAvailable}<a href={data.signedIn ? '/dashboard/billing' : '/login'} class="button secondary">View billing options</a>{:else}<span class="availability-label">Not available</span>{/if}
	</section>

	<div class="pricing-notes">
		<section><h2>Integrating with a laboratory workflow?</h2><p>This website provides browser validation. The TypeScript library, self-hosted Deno API, and Python wrapper are separate integration options. Website account keys do not grant access to a hosted validation API.</p><a href="/docs/integration">Read the integration guide <span aria-hidden="true">→</span></a></section>
		<section><h2>Know what a result means.</h2><p>Validation checks implemented notation rules. It is not complete ISCN certification, and review by a qualified professional remains essential. Browser results are not saved to your account.</p><a href="/docs/coverage">Read coverage and limitations <span aria-hidden="true">→</span></a></section>
	</div>
</div>

<style>
	.pricing-page { padding-block: 4rem 5rem; }
	.pricing-heading { max-width: 700px; margin-bottom: 3rem; }
	.pricing-heading h1 { font-size: clamp(2.25rem, 5vw, 4rem); }
	.access-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
	.access-card { padding: clamp(1.5rem, 4vw, 2.5rem); display: flex; flex-direction: column; min-width: 0; }
	.account-card { border-top: 3px solid var(--color-primary); }
	.access-card .section-label { margin-top: 0; }
	.access-card h2 { font-size: 1.75rem; letter-spacing: -0.025em; margin: 0.75rem 0; }
	.access-summary { color: var(--color-text-muted); font-size: 0.9rem; line-height: 1.65; max-width: 42ch; }
	.access-price { margin-block: 1.5rem; font-size: 1.75rem; font-weight: 600; letter-spacing: -0.03em; }
	.access-price span { display: block; margin-top: 0.6rem; color: var(--color-text-muted); font-size: 0.8rem; font-weight: 400; letter-spacing: 0; }
	ul { list-style: none; margin: 0 0 2rem; padding: 1.5rem 0 0; border-top: 1px solid var(--color-border); flex: 1; }
	li { padding-left: 1.5rem; position: relative; font-size: 0.9rem; line-height: 1.5; margin: 0.8rem 0; }
	li::before { content: '✓'; position: absolute; left: 0; color: var(--color-primary); }
	.paid-availability { display: flex; justify-content: space-between; align-items: center; gap: 2rem; padding: 2rem 2.5rem; margin-block: 1.5rem 3rem; }
	.paid-availability .section-label { margin-top: 0; }
	.paid-availability h2 { font-size: 1.15rem; margin: 0.7rem 0; }
	.paid-availability p:not(.section-label) { font-size: 0.85rem; color: var(--color-text-muted); line-height: 1.7; margin-bottom: 0; max-width: 70ch; }
	.paid-availability > .button { flex-shrink: 0; }
	.availability-label { font-size: 0.75rem; padding: 0.45rem 0.75rem; border: 1px solid var(--color-border); border-radius: 5px; white-space: nowrap; color: var(--color-text-muted); }
	.pricing-notes { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; padding: 0 0.5rem; }
	.pricing-notes h2 { font-size: 1rem; margin: 0; }
	.pricing-notes p { color: var(--color-text-muted); font-size: 0.85rem; line-height: 1.75; }
	.pricing-notes a { font-size: 0.85rem; font-weight: 600; }
	@media (max-width: 680px) {
		.pricing-page { padding-block: 2rem 3rem; }
		.access-grid, .pricing-notes { grid-template-columns: 1fr; }
		.paid-availability { align-items: start; flex-direction: column; gap: 1.25rem; padding: 1.5rem; }
	}
</style>
