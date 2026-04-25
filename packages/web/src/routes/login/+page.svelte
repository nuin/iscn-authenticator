<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<div class="login-container">
	<div class="form-panel">
		<h2>Log in</h2>
		<p class="muted">Enter any of your active API keys to access your dashboard.</p>

		<form method="POST" use:enhance>
			{#if form?.error}
				<p class="error">{form.error}</p>
			{/if}

			<div class="input-group">
				<label for="api_key">API Key</label>
				<input
					type="password"
					id="api_key"
					name="api_key"
					placeholder="iscn_live_..."
					autocomplete="current-password"
					spellcheck="false"
					required
				/>
			</div>

			<button type="submit" class="btn btn-primary">Log in</button>
		</form>

		<p class="signup-prompt">Don't have an account? <a href="/signup">Sign up</a>.</p>
	</div>
</div>

<style>
	.login-container {
		max-width: 480px;
		margin: 2rem auto;
	}

	.form-panel {
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

	input[type='password'] {
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

	.signup-prompt {
		margin-top: 1.5rem;
		text-align: center;
		font-size: 0.9rem;
		color: var(--color-text-muted);
	}
</style>
