<script lang="ts">
	import { enhance } from '$app/forms';
	import AccountAccess from '#lib/components/account/AccountAccess.svelte';
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>Log in · ISCN Authenticator</title></svelte:head>

<AccountAccess>
	<p class="section-label">Your account</p>
	<h1>Welcome back</h1>
	<p class="muted">Use an active account key to open your workspace.</p>
	<form method="POST" use:enhance>
		{#if form?.error}<p class="notice form-error" role="alert">{form.error}</p>{/if}
		<div class="field">
			<label for="api_key">Account key</label>
			<input type="password" id="api_key" name="api_key" placeholder="iscn_live_…" autocomplete="current-password" spellcheck="false" aria-describedby="key-help" required />
		</div>
		<p id="key-help" class="key-note">Enter the key saved when you created your account, or another active key from this website. Deno API keys use a separate account system.</p>
		<button type="submit" class="button">Log in</button>
	</form>
	<p class="account-switch">New to ISCN Authenticator? <a href="/signup">Create an account</a>.</p>
	<a class="public-link" href="/validate">Review one karyotype without an account <span aria-hidden="true">→</span></a>
</AccountAccess>

<style>
	h1 { font-size: clamp(1.75rem, 3vw, 2.25rem); letter-spacing: -0.035em; margin: 0.75rem 0 1rem; }
	p { line-height: 1.65; }
	form { margin-top: 2rem; }
	.field { display: grid; gap: 0.5rem; }
	input { width: 100%; min-width: 0; padding: 0.8rem 0.9rem; background: white; border: 1px solid var(--color-border); border-radius: 6px; font: inherit; font-family: var(--font-mono); }
	.key-note { color: var(--color-text-muted); font-size: 0.85rem; margin-block: 1.25rem; }
	form > .button { width: 100%; }
	.account-switch { margin-top: 1.75rem; font-size: 0.9rem; }
	.public-link { display: block; padding-top: 1.5rem; border-top: 1px solid var(--color-border); font-size: 0.85rem; }
	.form-error { color: #983535; margin-bottom: 1.25rem; }
</style>
