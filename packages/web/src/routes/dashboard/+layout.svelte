<script lang="ts">
	import { page } from '$app/state';
	let { children, data } = $props();
</script>

<header class="dashboard-header">
	<div>
		<h1>Dashboard</h1>
		<div class="user-meta">
			<span>{data.user.email}</span>
			<span>·</span>
			<form method="POST" action="/dashboard?/logout" style="display: inline;">
				<button type="submit" class="logout-btn">Log out</button>
			</form>
		</div>
	</div>
</header>

<nav class="tabs">
	<a href="/dashboard" class:active={page.url.pathname === '/dashboard'}>Overview</a>
	<a href="/dashboard/keys" class:active={page.url.pathname === '/dashboard/keys'}>Keys</a>
	{#if data.user.plan === 'pro'}
		<a href="/dashboard/batch" class:active={page.url.pathname === '/dashboard/batch'}>Batch</a>
	{/if}
	<a href="/dashboard/billing" class:active={page.url.pathname === '/dashboard/billing'}>Billing</a>
</nav>

<div class="panel">
	{@render children()}
</div>

<style>
	.dashboard-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
	}

	.user-meta {
		color: var(--color-text-muted);
		font-size: 0.875rem;
		margin-top: 0.25rem;
	}

	.logout-btn {
		background: none;
		border: none;
		color: var(--color-primary);
		padding: 0;
		cursor: pointer;
		text-decoration: underline;
		font-size: inherit;
	}

	.tabs {
		display: flex;
		gap: 0.5rem;
		margin-bottom: -1px;
		position: relative;
		z-index: 1;
	}

	.tabs a {
		padding: 0.75rem 1.25rem;
		text-decoration: none;
		color: var(--color-text);
		border: 1px solid transparent;
		border-bottom: none;
		border-radius: var(--radius) var(--radius) 0 0;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.tabs a:hover {
		background: rgba(0, 0, 0, 0.02);
	}

	.tabs a.active {
		background: white;
		border-color: var(--color-border);
		color: var(--color-primary);
	}

	.panel {
		background: white;
		border: 1px solid var(--color-border);
		border-radius: 0 var(--radius) var(--radius) var(--radius);
		padding: 2.5rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
	}

	@media (max-width: 600px) {
		.tabs {
			flex-wrap: wrap;
		}
		.tabs a {
			border-radius: var(--radius);
			border: 1px solid var(--color-border);
			margin-bottom: 0.5rem;
		}
		.panel {
			border-radius: var(--radius);
		}
	}
</style>
