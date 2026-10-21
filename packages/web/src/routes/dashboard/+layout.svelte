<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	let { children, data }: { children: Snippet; data: LayoutData } = $props();
	const navigation = [
		{ href: '/dashboard', label: 'Overview' },
		{ href: '/dashboard/batch', label: 'Batch review' },
		{ href: '/dashboard/keys', label: 'Account access' },
		{ href: '/dashboard/api', label: 'API access' },
		{ href: '/dashboard/billing', label: 'Billing' }
	];
</script>

<div class="page-shell workspace-shell">
	<aside class="workspace-sidebar">
		<div class="workspace-label">
			<span class="workspace-mark" aria-hidden="true">W</span>
			<div><strong>Workspace</strong><span>ISCN Authenticator</span></div>
		</div>
		<nav aria-label="Workspace navigation">
			{#each navigation as item}
				<a href={item.href} class:active={page.url.pathname === item.href} aria-current={page.url.pathname === item.href ? 'page' : undefined}>{item.label}</a>
			{/each}
		</nav>
		<div class="workspace-resources">
			<a href="/validate">Single review <span aria-hidden="true">↗</span></a>
			<a href="/docs/getting-started">Documentation <span aria-hidden="true">↗</span></a>
		</div>
		<div class="workspace-account">
			<span class="section-label">Signed in as</span>
			<p>{data.user.email}</p>
			<form method="POST" action="/dashboard?/logout">
				<button type="submit">Log out</button>
			</form>
		</div>
	</aside>
	<div class="workspace-content">{@render children()}</div>
</div>

<style>
	.workspace-shell { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 3rem; padding-block: 2.5rem 5rem; }
	.workspace-sidebar { align-self: start; position: sticky; top: 2rem; }
	.workspace-label { display: flex; gap: 0.75rem; align-items: center; padding: 0.25rem 0.5rem 1.75rem; }
	.workspace-label strong { display: block; font-size: 0.95rem; }
	.workspace-label div > span { display: block; font-size: 0.72rem; color: var(--color-text-muted); margin-top: 0.25rem; }
	.workspace-mark { display: grid; place-items: center; width: 36px; height: 36px; background: var(--color-primary); color: white; border-radius: 8px; font-family: var(--font-mono); }
	nav { display: grid; gap: 0.25rem; }
	nav a { display: block; padding: 0.8rem 1rem; border: 1px solid transparent; border-radius: 7px; color: var(--color-text-muted); text-decoration: none; font-size: 0.9rem; font-weight: 600; }
	nav a:hover { background: white; }
	nav a.active { background: #d9f1f5; color: var(--color-primary); border-color: #bbdee6; }
	.workspace-resources { display: grid; gap: 1rem; margin: 1.5rem 0; padding: 1.5rem 1rem; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); }
	.workspace-resources a { display: flex; justify-content: space-between; text-decoration: none; font-size: 0.8rem; color: var(--color-text-muted); }
	.workspace-account { padding-inline: 1rem; }
	.workspace-account .section-label { font-size: 0.7rem; }
	.workspace-account p { overflow-wrap: anywhere; font-size: 0.8rem; margin-block: 0.6rem 1rem; }
	.workspace-account button { border: 0; background: transparent; color: var(--color-primary); padding: 0.25rem 0; cursor: pointer; font: inherit; font-size: 0.85rem; text-decoration: underline; text-underline-offset: 3px; }
	.workspace-content { min-width: 0; }
	@media (max-width: 860px) {
		.workspace-shell { grid-template-columns: 1fr; gap: 2rem; padding-top: 1.5rem; }
		.workspace-sidebar { position: static; }
		.workspace-label { padding-bottom: 1rem; }
		nav { grid-template-columns: repeat(5, 1fr); }
		nav a { text-align: center; padding: 0.75rem 0.4rem; font-size: 0.8rem; }
		.workspace-resources { display: none; }
		.workspace-account { display: flex; align-items: center; flex-wrap: wrap; gap: 0.75rem; padding: 1rem 0.5rem 0; }
		.workspace-account p { margin: 0; flex: 1; }
		.workspace-account .section-label { display: none; }
	}
	@media (max-width: 430px) { nav { grid-template-columns: repeat(2, 1fr); } }
</style>
