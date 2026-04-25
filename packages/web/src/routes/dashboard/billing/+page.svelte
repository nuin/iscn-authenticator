<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="billing-container">
	<div class="current-plan-panel">
		<div class="plan-header">
			<div>
				<span class="muted">CURRENT PLAN</span>
				<h2>{data.user.plan.toUpperCase()}</h2>
			</div>
			<div class="plan-badge {data.user.plan}">
				{data.user.plan === 'pro' ? 'Paid' : 'Free'}
			</div>
		</div>

		<div class="plan-details">
			{#if data.user.plan === 'pro'}
				<p>Your Pro subscription is active. Thank you for supporting ISCN Authenticator!</p>
				<form method="POST" action="?/manage" use:enhance>
					<button type="submit" class="btn">Manage Subscription</button>
				</form>
			{:else}
				<p>Unlock batch validation, history, and curated library access.</p>
				<form method="POST" action="?/upgrade" use:enhance>
					<button type="submit" class="btn btn-primary">Upgrade to Pro — $29/mo</button>
				</form>
			{/if}
		</div>

		{#if form?.message}
			<p class="form-message">{form.message}</p>
		{/if}
	</div>

	<div class="invoices-section">
		<h3>Recent Invoices</h3>
		<p class="muted">No recent invoices found.</p>
	</div>
</div>

<style>
	.current-plan-panel {
		background: var(--color-bg);
		padding: 2rem;
		border-radius: var(--radius);
		margin-bottom: 3rem;
	}

	.plan-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.5rem;
	}

	.muted {
		color: var(--color-text-muted);
		font-size: 0.75rem;
		font-weight: bold;
		letter-spacing: 0.05em;
	}

	h2 {
		margin: 0.25rem 0 0;
	}

	.plan-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: bold;
		background: #dee2e6;
		color: #495057;
	}

	.plan-badge.pro {
		background: var(--color-primary);
		color: white;
	}

	.plan-details {
		margin-top: 2rem;
	}

	.btn {
		margin-top: 1rem;
		padding: 0.75rem 1.5rem;
		border-radius: 6px;
		border: 1px solid var(--color-border);
		background: white;
		cursor: pointer;
		font-weight: 500;
	}

	.btn-primary {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}

	.form-message {
		margin-top: 1.5rem;
		padding: 1rem;
		background: #eef6ff;
		border-radius: 6px;
		color: var(--color-primary);
		font-size: 0.9rem;
	}

	.invoices-section h3 {
		font-size: 1rem;
		margin-bottom: 1rem;
	}
</style>
