<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Billing · ISCN Authenticator</title></svelte:head>

<header class="page-heading">
	<p class="section-label">Account settings</p>
	<h1>Billing</h1>
	<p>Your account access and available billing options.</p>
</header>

{#if form?.message}<p class="notice" role="alert">{form.message}</p>{/if}

<section class="panel plan-panel" aria-labelledby="current-plan">
	<div class="plan-heading"><div><p class="section-label">Current account plan</p><h2 id="current-plan">{data.user.plan}</h2></div><span class="access-label">Browser workspace</span></div>
	<p>Your account includes batch review and account key management. Individual validation and the example library are also available without signing in.</p>
	<a href="/pricing">View availability <span aria-hidden="true">→</span></a>
</section>

<section class="panel billing-options" aria-labelledby="billing-options">
	<h2 id="billing-options">Subscription and payments</h2>
	{#if data.portalAvailable}
		<p>Open the secure billing portal to review your subscription, payment details, and any available invoices.</p>
		<form method="POST" action="?/manage" use:enhance><button type="submit" class="button secondary">Manage subscription</button></form>
	{:else if data.user.plan === 'pro'}
		<p class="notice">The billing portal is not available for this account at the moment.</p>
	{/if}
	{#if data.user.plan !== 'pro'}
		{#if data.checkoutAvailable}
			<p>{#if data.offering}{data.offering.displayPrice} per month includes {data.offering.monthlyLimit.toLocaleString('en')} API validations per subscription period.{/if} No automatic overage charges. Review the final total in Stripe before confirming payment.</p>
			<form method="POST" action="?/upgrade" use:enhance><button type="submit" class="button">Review checkout</button></form>
		{:else}
			<div class="availability-note"><span class="availability-mark" aria-hidden="true"></span><strong>Paid checkout is not available yet</strong></div>
			<p>You can continue using the browser workspace. A paid offering and its price will be shown when checkout is available.</p>
		{/if}
	{/if}
</section>

<p class="billing-note">Subscriptions enable the <a href="/dashboard/api">hosted validation API</a> after payment is confirmed. Browser checks remain free. Integration keys are separate from website account keys and self-hosted Deno keys. <a href="/docs/hosted-api">Read the API guide</a>.</p>

<style>
	.plan-panel, .billing-options { padding: clamp(1.5rem, 4vw, 2rem); margin-bottom: 1.5rem; }
	.plan-heading { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 1rem; align-items: start; }
	.plan-heading .section-label { margin-top: 0; }
	.plan-heading h2 { text-transform: capitalize; font-size: 2rem; margin: 0.75rem 0 0; letter-spacing: -0.025em; }
	.access-label { font-size: 0.75rem; padding: 0.4rem 0.6rem; border-radius: 4px; background: #edf7f9; color: var(--color-primary); }
	.plan-panel > p, .billing-options > p { color: var(--color-text-muted); font-size: 0.9rem; line-height: 1.75; margin: 1.5rem 0; max-width: 65ch; }
	.plan-panel > a { font-size: 0.85rem; font-weight: 600; }
	.billing-options h2 { margin: 0; font-size: 1.15rem; }
	.availability-note { display: flex; align-items: center; gap: 0.7rem; margin-top: 1.75rem; font-size: 0.9rem; }
	.availability-mark { width: 8px; height: 8px; flex-shrink: 0; border-radius: 50%; background: var(--color-text-muted); }
	.billing-note { font-size: 0.8rem; color: var(--color-text-muted); line-height: 1.75; }
</style>
