<h2 style="text-align: center; margin-bottom: 2rem;">Simple, transparent pricing</h2>

<div class="pricing-grid">
	<div class="pricing-card">
		<h3>Free</h3>
		<div class="price">$0<span>/mo</span></div>
		<ul>
			<li>1,000 API requests / mo</li>
			<li>Local-first validation</li>
			<li>Basic interpretations</li>
			<li>Community support</li>
		</ul>
		<a href="/signup" class="button button-outline">Get Started</a>
	</div>
	<div class="pricing-card featured">
		<div class="badge">Recommended</div>
		<h3>Pro</h3>
		<div class="price">$29<span>/mo</span></div>
		<ul>
			<li>100,000 API requests / mo</li>
			<li><strong>Batch validation (500 rows)</strong></li>
			<li><strong>Curated interpretation library</strong></li>
			<li>CSV/JSON exports</li>
			<li>Priority email support</li>
		</ul>
		<a href="/signup" class="button">Go Pro</a>
	</div>
</div>

<style>
	.pricing-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		margin-top: 2rem;
	}

	.pricing-card {
		padding: 2.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius);
		display: flex;
		flex-direction: column;
		position: relative;
		background: var(--color-surface);
	}

	.pricing-card.featured {
		border-color: var(--color-primary);
		box-shadow: 0 4px 12px rgba(13, 110, 253, 0.15);
	}

	.pricing-card .badge {
		position: absolute;
		top: -12px;
		right: 2rem;
		background: var(--color-primary);
		color: white;
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.75rem;
		font-weight: bold;
	}

	.pricing-card h3 {
		margin-top: 0;
		font-size: 1.5rem;
	}

	.price {
		font-size: 2.5rem;
		font-weight: bold;
		margin: 1.5rem 0;
	}

	.price span {
		font-size: 1rem;
		color: var(--color-text-muted);
		font-weight: normal;
	}

	.pricing-card ul {
		list-style: none;
		padding: 0;
		margin: 1.5rem 0;
		flex: 1;
	}

	.pricing-card li {
		margin-bottom: 0.75rem;
		padding-left: 1.5rem;
		position: relative;
	}

	.pricing-card li::before {
		content: '✓';
		position: absolute;
		left: 0;
		color: var(--color-primary);
		font-weight: bold;
	}

	.button {
		display: block;
		text-align: center;
		background: var(--color-primary);
		color: white;
		padding: 1rem;
		border-radius: 4px;
		text-decoration: none;
		font-weight: 500;
	}

	.button-outline {
		background: transparent;
		border: 2px solid var(--color-primary);
		color: var(--color-primary);
	}

	@media (max-width: 600px) {
		.pricing-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
