<script lang="ts">
	let { compact = false }: { compact?: boolean } = $props();
</script>

<span class="brand">
	<svg viewBox="0 0 32 38" width="28" height="34" aria-hidden="true">
		<path d="M7 3v9l6 7-6 7v9M25 3v9l-6 7 6 7v9" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" />
		<path d="M4 7h6M22 7h6M4 30h6M22 30h6" stroke="var(--color-bg)" stroke-width="2" />
	</svg>
	<span>ISCN{#if !compact}<span class="brand-name">Authenticator</span>{/if}</span>
</span>

<style>
	.brand { display: inline-flex; align-items: center; gap: .7rem; color: var(--color-primary); line-height: 1.1; font-size: 1.15rem; font-weight: 700; letter-spacing: -.025em; }
	.brand > span { display: flex; align-items: baseline; gap: .36rem; }
	.brand-name { font-size: 1rem; font-weight: 450; color: var(--color-text); letter-spacing: -.025em; }
	@media (max-width: 420px) { .brand-name { font-size: .87rem; } .brand { font-size: 1rem; gap: .5rem; } }
</style>
