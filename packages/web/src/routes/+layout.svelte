<script>
	let { children } = $props();
</script>

<nav class="nav-bar">
	<div class="nav-content">
		<a href="/" class="brand">ISCN Authenticator</a>
		<div class="nav-links">
			<a href="/explain">Library</a>
			<a href="/pricing">Pricing</a>
			<a href="/docs">API</a>
			<a href="/dashboard">Dashboard</a>
		</div>
	</div>
</nav>

<div class="container">
	<main>
		{@render children()}
	</main>
</div>

<footer>
	&copy; 2026 ISCN Authenticator. Built for the clinical genetics community.
</footer>

<style>
	:global(:root) {
		--color-bg: #f8f9fa;
		--color-surface: #ffffff;
		--color-text: #212529;
		--color-text-muted: #6c757d;
		--color-primary: #0d6efd;
		--color-border: #dee2e6;
		--font-mono: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
		--radius: 8px;
	}

	:global(body) {
		font-family: system-ui, -apple-system, sans-serif;
		background: var(--color-bg);
		color: var(--color-text);
		margin: 0;
		padding: 0;
	}

	:global(a) {
		color: var(--color-primary);
	}

	.nav-bar {
		background: var(--color-surface);
		border-bottom: 1px solid var(--color-border);
		padding: 1rem;
	}

	.nav-content {
		max-width: 960px;
		margin: 0 auto;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.brand {
		font-weight: bold;
		text-decoration: none;
		color: var(--color-text);
	}

	.nav-links a {
		margin-left: 1.5rem;
		text-decoration: none;
		color: var(--color-text);
		font-size: 0.875rem;
	}

	.container {
		max-width: 960px;
		margin: 2rem auto;
		background: var(--color-surface);
		padding: 3rem;
		border-radius: var(--radius);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
	}

	main {
		line-height: 1.6;
	}

	footer {
		max-width: 960px;
		margin: 2rem auto;
		text-align: center;
		color: var(--color-text-muted);
		font-size: 0.75rem;
		padding-bottom: 3rem;
	}

	@media (max-width: 600px) {
		.container {
			margin: 1rem;
			padding: 1.5rem;
		}
		.nav-links {
			display: none;
		}
	}
</style>
