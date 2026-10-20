<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import Brand from '#lib/components/Brand.svelte';
	let { children, data }: { children: Snippet; data: LayoutData } = $props();
	let menuOpen = $state(false);
	const links = [
		{ href: '/validate', label: 'Validator' },
		{ href: '/review', label: 'Report review' },
		{ href: '/explain', label: 'Examples' },
		{ href: '/docs', label: 'Documentation' },
		{ href: '/pricing', label: 'Plans' }
	];
	$effect(() => { void data.pathname; menuOpen = false; });
	const current = (href: string) => data.pathname === href || data.pathname.startsWith(`${href}/`);
</script>

<svelte:head><meta name="theme-color" content="#005b73" /></svelte:head>
<a class="skip-link" href="#main-content">Skip to content</a>
<header class="site-header">
	<div class="page-shell header-content">
		<a class="brand-link" href="/" aria-label="ISCN Authenticator home"><Brand /></a>
		<nav class="desktop-nav" aria-label="Main navigation">
			{#each links as link}<a href={link.href} class:current={current(link.href)} aria-current={current(link.href) ? 'page' : undefined}>{link.label}</a>{/each}
		</nav>
		<div class="header-actions">
			{#if data.signedIn}<a href="/dashboard" class="button secondary">Workspace</a>{:else}<a href="/login" class="sign-in">Log in</a><a href="/signup" class="button">Create account</a>{/if}
		</div>
		<button class="menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onclick={() => menuOpen = !menuOpen}>
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">{#if menuOpen}<path d="m6 6 12 12M6 18 18 6" />{:else}<path d="M4 7h16M4 12h16M4 17h16" />{/if}</svg>
		</button>
	</div>
	{#if menuOpen}
		<nav id="mobile-navigation" class="mobile-nav page-shell" aria-label="Mobile navigation">
			{#each links as link}<a href={link.href} aria-current={current(link.href) ? 'page' : undefined}>{link.label}</a>{/each}
			<a href={data.signedIn ? '/dashboard' : '/login'}>{data.signedIn ? 'Workspace' : 'Log in'}</a>
			{#if !data.signedIn}<a href="/signup" class="button">Create account</a>{/if}
		</nav>
	{/if}
</header>
<main id="main-content" tabindex="-1">{@render children()}</main>
<footer class="site-footer">
	<div class="page-shell footer-content">
		<div class="footer-brand"><a href="/" class="brand-link" aria-label="ISCN Authenticator home"><Brand /></a><p>A notation workspace by Bioinformat.<br />Clearer notation. More informed review.</p></div>
		<div><h2>Workspace</h2><a href="/validate">Single karyotype</a><a href="/review">Report review</a><a href="/dashboard/batch">Batch review</a><a href="/explain">Example library</a></div>
		<div><h2>Resources</h2><a href="/docs/getting-started">Getting started</a><a href="/docs/coverage">Coverage and limitations</a><a href="/docs/integration">Integration guide</a></div>
		<div><h2>About</h2><a href="/about">The project</a><a href="/privacy">Data and privacy</a><a href="/terms">Terms of use</a></div>
	</div>
	<div class="page-shell footer-bottom"><span>© {new Date().getFullYear()} ISCN Authenticator</span><p>Notation checks for research and technical review.</p><a href="https://github.com/nuin/iscn-authenticator">Source code</a></div>
</footer>
<style>
	.site-header { background: #fff; border-bottom: 1px solid var(--color-border); }
	.header-content { min-height: 88px; display: flex; align-items: center; justify-content: space-between; gap: 2rem; }
	.brand-link { display: inline-flex; text-decoration: none; flex-shrink: 0; }
	.desktop-nav { display: flex; gap: 1.7rem; align-items: center; }
	.desktop-nav a { color: var(--color-text-muted); font-size: .8rem; text-decoration: none; padding-block: .5rem; }
	.desktop-nav a.current { color: var(--color-primary); box-shadow: 0 2px var(--color-primary); }
	.header-actions { display: flex; align-items: center; gap: 1.5rem; }
	.header-actions .button { min-height: 40px; padding: .65rem 1rem; font-size: .75rem; }
	.sign-in { font-size: .8rem; text-decoration: none; color: var(--color-text); white-space: nowrap; }
	.menu-toggle { display: none; background: transparent; border: 1px solid var(--color-border); color: var(--color-primary); width: 42px; height: 42px; border-radius: 6px; align-items: center; justify-content: center; }
	.mobile-nav { padding-block: .5rem 1.5rem; display: flex; flex-direction: column; gap: .25rem; }
	.mobile-nav a { padding: .8rem; text-decoration: none; font-size: .9rem; }
	.mobile-nav a[aria-current] { background: #edf6fa; border-radius: 6px; }
	.skip-link { position: fixed; top: -100px; left: 1rem; z-index: 20; padding: 1rem; background: white; }
	.skip-link:focus { top: 1rem; }
	main { min-height: 60vh; }
	main:focus { outline: none; }
	.site-footer { border-top: 1px solid var(--color-border); background: #fff; }
	.footer-content { display: grid; grid-template-columns: 1.6fr 1fr 1.2fr .8fr; gap: 3rem; padding-block: 3.5rem; }
	.footer-brand p { margin: 1.2rem 0 0; font-size: .85rem; color: var(--color-text-muted); }
	.footer-content h2 { font-size: .8rem; margin: 0 0 1.2rem; letter-spacing: 0; }
	.footer-content > div:not(.footer-brand) a { display: block; font-size: .78rem; color: var(--color-text-muted); text-decoration: none; margin-top: .7rem; }
	.footer-content a:hover { color: var(--color-primary); text-decoration: underline; }
	.footer-bottom { display: flex; gap: 1.5rem; align-items: baseline; justify-content: space-between; padding-block: 1.25rem; border-top: 1px solid var(--color-border); color: var(--color-text-muted); font-size: .7rem; }
	.footer-bottom p { margin: 0; }
	.footer-bottom a { color: inherit; }
	@media (max-width: 1060px) { .desktop-nav { gap: 1rem; } .header-content { gap: 1rem; } .header-actions { gap: 1rem; } }
	@media (max-width: 980px) { .desktop-nav, .header-actions { display: none; } .menu-toggle { display: flex; } .header-content { min-height: 76px; } .footer-content { gap: 2rem; grid-template-columns: 1.4fr 1fr; } }
	@media (max-width: 480px) { .footer-content { grid-template-columns: 1fr 1fr; gap: 2rem 1rem; } .footer-brand { grid-column: 1/-1; } .footer-bottom { flex-wrap: wrap; gap: .5rem 1rem; } .footer-bottom p { width: 100%; order: 1; } }
</style>
