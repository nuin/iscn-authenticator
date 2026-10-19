<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children }: { children: Snippet } = $props();
</script>

<div class="page-shell account-access">
	<aside class="account-introduction">
		<p class="section-label">Your laboratory workspace</p>
		<h2>Keep the review<br />in your hands.</h2>
		<p>Review karyotype notation, work through a batch, and explore the checks behind each result.</p>
		<ul>
			<li><span aria-hidden="true">01</span> Validate individual karyotypes in your browser.</li>
			<li><span aria-hidden="true">02</span> Review up to 500 rows in a signed-in batch.</li>
			<li><span aria-hidden="true">03</span> Download results when you are ready.</li>
		</ul>
		<a href="/docs/accounts-and-keys">How accounts and keys work <span aria-hidden="true">↗</span></a>
	</aside>
	<section class="panel account-form" aria-label="Account access">
		{@render children()}
	</section>
</div>

<style>
	.account-access { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(2rem, 6vw, 6rem); align-items: start; padding-block: 4rem 6rem; }
	.account-introduction { padding-top: 1rem; }
	.account-introduction h2 { font-size: clamp(2rem, 4vw, 3.25rem); line-height: 1.14; letter-spacing: -0.04em; margin: 1rem 0 1.5rem; }
	.account-introduction > p:not(.section-label) { color: var(--color-text-muted); max-width: 42ch; line-height: 1.7; }
	ul { list-style: none; padding: 0; margin: 2rem 0; }
	li { display: flex; gap: 1rem; align-items: baseline; margin: 1.25rem 0; line-height: 1.5; }
	li span { color: var(--color-primary); font-family: var(--font-mono); font-size: 0.8rem; }
	.account-introduction > a { font-weight: 600; font-size: 0.9rem; }
	.account-form { min-width: 0; padding: clamp(1.25rem, 4vw, 2.5rem); }
	@media (max-width: 760px) {
		.account-access { grid-template-columns: 1fr; padding-block: 2rem 3rem; gap: 2.5rem; }
		.account-introduction { order: 2; }
		.account-introduction h2 { font-size: 2rem; }
	}
</style>
