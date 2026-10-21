<script lang="ts">
	import { enhance } from '$app/forms';
	import KeyReveal from '#lib/components/account/KeyReveal.svelte';
	import type { ActionData, PageData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
	const dateFormat = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
	const formatDate = (timestamp: number) => dateFormat.format(new Date(timestamp * 1000));
</script>

<svelte:head><title>Account keys · ISCN Authenticator</title></svelte:head>

<header class="page-heading">
	<p class="section-label">Account access</p>
	<h1>Account keys</h1>
	<p>Manage the credentials that sign you in to this workspace.</p>
</header>

<div class="notice key-scope">
	<strong>For this website</strong>
	<p>These keys provide access to your account. For hosted API requests, create a separate key on the <a href="/dashboard/api">API access page</a>. These account keys do not authenticate API requests. <a href="/docs/integration">Read the integration guide</a>.</p>
</div>

{#if form?.message}<p class="notice form-error" role="alert">{form.message}</p>{/if}
{#if form?.success && form.plaintext}
	{#key form.plaintext}<KeyReveal plaintext={form.plaintext} />{/key}
{:else if form?.success}
	<p class="notice" role="status">Key revoked. It can no longer be used to sign in.</p>
{/if}

<div class="section-heading">
	<h2>Your keys <span>{data.keys.length}</span></h2>
	<form method="POST" action="?/create" use:enhance>
		<button type="submit" class="button">Create new key</button>
	</form>
</div>

<div class="key-list">
	{#each data.keys as key (key.id)}
		<article class="panel key-record" class:revoked={key.revoked_at !== null}>
			<div class="key-heading"><h3>{key.label}</h3><span class="key-status">{key.revoked_at !== null ? 'Revoked' : 'Active'}</span></div>
			<p class="key-id"><span>Key ID</span><code>{key.id}</code></p>
			<dl>
				<div><dt>Created</dt><dd>{formatDate(key.created_at)}</dd></div>
				<div><dt>Last sign-in</dt><dd>{key.last_used_at === null ? 'Not used yet' : formatDate(key.last_used_at)}</dd></div>
				{#if key.revoked_at !== null}<div><dt>Revoked</dt><dd>{formatDate(key.revoked_at)}</dd></div>{/if}
			</dl>
			{#if key.revoked_at === null}
				<form method="POST" action="?/revoke" use:enhance>
					<input type="hidden" name="key_id" value={key.id} />
					<button type="submit" class="button quiet revoke" aria-label={`Revoke ${key.label} (${key.id})`}>Revoke key</button>
				</form>
			{/if}
		</article>
	{:else}
		<div class="panel empty-state"><h3>No account keys</h3><p>Create a key and save it before logging out so you can return to your workspace.</p></div>
	{/each}
</div>

<p class="key-footnote">Dates are shown in UTC. Revoking a key blocks future sign-ins with that key; existing sessions remain active. Keep at least one active key saved securely. <a href="/docs/accounts-and-keys">Learn more about account access</a>.</p>

<style>
	.key-scope { margin-bottom: 2rem; }
	.key-scope strong { font-size: 0.85rem; }
	.key-scope p { margin: 0.5rem 0 0; font-size: 0.85rem; line-height: 1.7; }
	.section-heading { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 1rem; align-items: center; margin-block: 2rem 1rem; }
	.section-heading h2 { font-size: 1.1rem; margin: 0; }
	.section-heading h2 span { color: var(--color-text-muted); font-family: var(--font-mono); margin-left: 0.6rem; font-size: 0.85rem; font-weight: 400; }
	.key-list { display: grid; gap: 1rem; }
	.key-record { padding: 1.5rem; position: relative; }
	.key-heading { display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
	.key-heading h3 { margin: 0; font-size: 1rem; }
	.key-status { font-size: 0.7rem; border: 1px solid #bbdee6; color: var(--color-primary); background: #edf7f9; padding: 0.3rem 0.6rem; border-radius: 4px; }
	.key-id { display: flex; flex-wrap: wrap; gap: 0.6rem; color: var(--color-text-muted); font-size: 0.75rem; margin-block: 1rem 1.25rem; }
	.key-id code { overflow-wrap: anywhere; font-family: var(--font-mono); }
	dl { display: flex; flex-wrap: wrap; gap: 1rem 2rem; margin: 0; padding-right: 7rem; }
	dt { font-size: 0.7rem; color: var(--color-text-muted); }
	dd { margin: 0.4rem 0 0; font-size: 0.8rem; }
	.key-record form { position: absolute; right: 1.5rem; bottom: 1.25rem; }
	.revoke { color: #983535; font-size: 0.8rem; }
	.revoked { background: transparent; }
	.revoked .key-status { background: transparent; border-color: var(--color-border); color: var(--color-text-muted); }
	.key-footnote { font-size: 0.8rem; color: var(--color-text-muted); line-height: 1.75; margin-top: 1.5rem; }
	.empty-state { padding: 2rem; text-align: center; }
	.empty-state h3 { font-size: 1rem; }
	.empty-state p { font-size: 0.9rem; color: var(--color-text-muted); }
	.form-error { color: #983535; }
	@media (max-width: 500px) { dl { padding-right: 0; } .key-record form { position: static; margin-top: 1.25rem; } }
</style>
