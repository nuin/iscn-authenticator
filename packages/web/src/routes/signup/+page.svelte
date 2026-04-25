<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<div class="signup-container">
	{#if form?.success}
		<div class="success-panel">
			<h2>Account created</h2>
			<dl class="kv">
				<dt>Email</dt>
				<dd>{form.email}</dd>
				<dt>Tier</dt>
				<dd>free</dd>
				<dt>Key id</dt>
				<dd>{form.keyId}</dd>
			</dl>
			<div class="plaintext-reveal">
				<strong>Save this key — it will only be shown once.</strong>
				<code>{form.plaintext}</code>
			</div>
			<p class="muted">
				We never store the plaintext. If you lose it, rotate the key from the dashboard.
			</p>
			<div class="actions">
				<a href="/dashboard" class="btn btn-primary">Continue to dashboard</a>
			</div>
		</div>
	{:else}
		<div class="form-panel">
			<h2>Create an account</h2>
			<p class="muted">Free tier — 1,000 requests per month. No credit card required.</p>

			<form method="POST" use:enhance>
				{#if form?.error}
					<p class="error">{form.error}</p>
				{/if}

				<div class="input-group">
					<label for="email">Email</label>
					<input
						type="email"
						id="email"
						name="email"
						value={form?.email ?? ''}
						autocomplete="email"
						spellcheck="false"
						required
					/>
				</div>

				<button type="submit" class="btn btn-primary">Sign up</button>
			</form>

			<p class="login-prompt">Already have a key? <a href="/login">Log in</a>.</p>
		</div>
	{/if}
</div>

<style>
	.signup-container {
		max-width: 480px;
		margin: 2rem auto;
	}

	.form-panel,
	.success-panel {
		background: white;
		padding: 2.5rem;
		border-radius: var(--radius);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
	}

	h2 {
		margin-top: 0;
		margin-bottom: 1rem;
	}

	.muted {
		color: var(--color-text-muted);
		font-size: 0.9rem;
		margin-bottom: 1.5rem;
	}

	.input-group {
		margin-bottom: 1.5rem;
	}

	.input-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		font-size: 0.9rem;
	}

	input[type='email'] {
		width: 100%;
		padding: 0.75rem;
		border: 2px solid var(--color-border);
		border-radius: 8px;
		font-size: 1rem;
		box-sizing: border-box;
	}

	.btn {
		width: 100%;
		padding: 0.75rem;
		border-radius: 8px;
		border: none;
		font-weight: 600;
		cursor: pointer;
		text-align: center;
		text-decoration: none;
		display: block;
	}

	.btn-primary {
		background: var(--color-primary);
		color: white;
	}

	.error {
		background: #f8d7da;
		color: #842029;
		padding: 0.75rem;
		border-radius: 4px;
		margin-bottom: 1.5rem;
		font-size: 0.9rem;
	}

	.login-prompt {
		margin-top: 1.5rem;
		text-align: center;
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}

	.kv {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.5rem 1.5rem;
		margin-bottom: 2rem;
	}

	.kv dt {
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.kv dd {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.9rem;
	}

	.plaintext-reveal {
		background: #d1e7dd;
		border: 1px solid #198754;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.plaintext-reveal strong {
		display: block;
		margin-bottom: 0.5rem;
		color: #0f5132;
	}

	.plaintext-reveal code {
		display: block;
		background: white;
		padding: 0.75rem;
		border-radius: 4px;
		word-break: break-all;
		font-family: var(--font-mono);
		border: 1px solid #198754;
	}

	.actions {
		margin-top: 2rem;
	}
</style>
