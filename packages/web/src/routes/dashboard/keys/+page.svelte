<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	function formatDate(ts: number | null) {
		if (!ts) return 'Never';
		return new Date(ts * 1000).toLocaleString();
	}
</script>

<div class="keys-container">
	<header class="section-header">
		<h2>API Keys</h2>
		<form method="POST" action="?/create" use:enhance>
			<button type="submit" class="btn btn-primary">Create New Key</button>
		</form>
	</header>

	{#if form?.success && form.plaintext}
		<div class="plaintext-reveal">
			<strong>Save this key — it will only be shown once.</strong>
			<code>{form.plaintext}</code>
		</div>
	{/if}

	<div class="keys-table-container">
		<table>
			<thead>
				<tr>
					<th>Label</th>
					<th>ID</th>
					<th>Created</th>
					<th>Last Used</th>
					<th>Action</th>
				</tr>
			</thead>
			<tbody>
				{#each data.keys as key}
					<tr class:revoked={key.revoked_at}>
						<td>{key.label}</td>
						<td class="mono">{key.id.substring(0, 8)}...</td>
						<td>{formatDate(key.created_at)}</td>
						<td>{formatDate(key.last_used_at)}</td>
						<td>
							{#if key.revoked_at}
								<span class="revoked-tag">Revoked {formatDate(key.revoked_at)}</span>
							{:else}
								<form method="POST" action="?/revoke" use:enhance>
									<input type="hidden" name="key_id" value={key.id} />
									<button type="submit" class="btn btn-danger">Revoke</button>
								</form>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	h2 {
		margin: 0;
	}

	.btn {
		padding: 0.5rem 1rem;
		border-radius: 4px;
		font-weight: 500;
		cursor: pointer;
		border: none;
	}

	.btn-primary {
		background: var(--color-primary);
		color: white;
	}

	.btn-danger {
		background: #dc3545;
		color: white;
	}

	.plaintext-reveal {
		background: #d1e7dd;
		border: 1px solid #198754;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 2rem;
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
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	th,
	td {
		text-align: left;
		padding: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	th {
		color: var(--color-text-muted);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.mono {
		font-family: var(--font-mono);
		font-size: 0.85rem;
	}

	.revoked td {
		color: var(--color-text-muted);
		background: rgba(0, 0, 0, 0.02);
	}

	.revoked-tag {
		font-size: 0.75rem;
		color: #dc3545;
		font-weight: 500;
	}
</style>
