<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<div class="overview-grid">
	<div class="stat-card">
		<h3>Monthly Usage</h3>
		<div class="usage-meter">
			<div class="meter-bar">
				<div class="fill" style="width: {(data.usage.used / data.usage.limit) * 100}%"></div>
			</div>
			<div class="meter-labels">
				<span>{data.usage.used.toLocaleString()} / {data.usage.limit.toLocaleString()}</span>
				<span>{Math.round((data.usage.used / data.usage.limit) * 100)}%</span>
			</div>
		</div>
	</div>

	<div class="stat-card">
		<h3>Current Plan</h3>
		<div class="plan-info">
			<span class="plan-tag {data.user.plan}">{data.user.plan.toUpperCase()}</span>
			{#if data.user.plan === 'free'}
				<a href="/dashboard/billing" class="upgrade-link">Upgrade to Pro &rarr;</a>
			{/if}
		</div>
	</div>
</div>

<style>
	.overview-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
	}

	.stat-card {
		padding: 1.5rem;
		background: var(--color-bg);
		border-radius: var(--radius);
	}

	h3 {
		margin-top: 0;
		font-size: 0.9rem;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.usage-meter {
		margin-top: 1.5rem;
	}

	.meter-bar {
		height: 8px;
		background: #dee2e6;
		border-radius: 4px;
		overflow: hidden;
	}

	.fill {
		height: 100%;
		background: var(--color-primary);
		border-radius: 4px;
	}

	.meter-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.plan-info {
		margin-top: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.plan-tag {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: bold;
		background: #6c757d;
		color: white;
		width: fit-content;
	}

	.plan-tag.pro {
		background: var(--color-primary);
	}

	.upgrade-link {
		font-size: 0.9rem;
		text-decoration: none;
		font-weight: 500;
	}

	@media (max-width: 600px) {
		.overview-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
