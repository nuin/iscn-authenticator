<script lang="ts">
	import { enhance } from '$app/forms';
	import AccountAccess from '#lib/components/account/AccountAccess.svelte';
	import KeyReveal from '#lib/components/account/KeyReveal.svelte';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>Create an account · ISCN Authenticator</title></svelte:head>

<AccountAccess>
	{#if form?.success}
		<p class="section-label">Ready for review</p>
		<h1>Account created</h1>
		<p class="muted">Your workspace is ready for <strong>{form.email}</strong>.</p>
		{#if form.plaintext}<KeyReveal plaintext={form.plaintext} />{/if}
		<p class="key-note">This key signs you in to this website. It does not authenticate the separately deployed Deno API.</p>
		<a href="/dashboard" class="button continue">Continue to dashboard <span aria-hidden="true">→</span></a>
	{:else}
		<p class="section-label">Create your workspace</p>
		<h1>Create an account</h1>
		<p class="muted">Get access to batch review and manage your account keys. No payment details required.</p>
		<form method="POST" use:enhance={() => ({ update }) => update({ refreshAll: false })}>
			{#if form?.error}<p class="notice form-error" role="alert">{form.error}</p>{/if}
			<div class="field">
				<label for="email">Email</label>
				<input type="email" id="email" name="email" value={form?.email ?? ''} autocomplete="email" spellcheck="false" placeholder="you@laboratory.org" required />
			</div>
			<p class="key-note">You will receive an account key to save securely. Use this key each time you sign in.</p>
			<button type="submit" class="button">Sign up</button>
		</form>
		<p class="account-switch">Already have an account key? <a href="/login">Log in</a>.</p>
		<p class="terms-note">Read our <a href="/privacy">privacy notice</a> and <a href="/terms">terms of use</a>.</p>
	{/if}
</AccountAccess>

<style>
	h1 { font-size: clamp(1.75rem, 3vw, 2.25rem); letter-spacing: -0.035em; margin: 0.75rem 0 1rem; }
	p { line-height: 1.65; }
	strong { overflow-wrap: anywhere; }
	form { margin-top: 2rem; }
	.field { display: grid; gap: 0.5rem; }
	input { width: 100%; min-width: 0; padding: 0.8rem 0.9rem; background: white; border: 1px solid var(--color-border); border-radius: 6px; font: inherit; }
	.key-note, .terms-note { color: var(--color-text-muted); font-size: 0.85rem; }
	.key-note { margin-block: 1.25rem; }
	form > .button, .continue { width: 100%; }
	.account-switch { margin-top: 1.75rem; font-size: 0.9rem; }
	.terms-note { margin-bottom: 0; }
	.form-error { color: #983535; margin-bottom: 1.25rem; }
</style>
