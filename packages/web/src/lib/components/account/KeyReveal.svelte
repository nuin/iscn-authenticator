<script lang="ts">
	let { plaintext, kind = 'account', onDismiss }: { plaintext: string; kind?: 'account' | 'API'; onDismiss?: () => void } = $props();
	let copyMessage = $state('');
	let copyFailed = $state(false);

	async function copyKey() {
		try {
			await navigator.clipboard.writeText(plaintext);
			copyFailed = false;
			copyMessage = `${kind === 'API' ? 'API' : 'Account'} key copied. Save it securely.`;
		} catch {
			copyFailed = true;
			copyMessage = 'Copy was unavailable. Select the key above and copy it manually.';
		}
	}
</script>

<div class="plaintext-reveal">
	<strong>Save your {kind} key now</strong>
	<p>This is the only time the full key will be shown. {kind === 'API' ? 'Keep it in your server’s secret store. It grants API access when your subscription is active.' : 'You will need it to sign in again.'}</p>
	<div role="textbox" aria-readonly="true" tabindex="0" aria-label={`Your new ${kind} key`}><code>{plaintext}</code></div>
	<button type="button" class="button secondary" onclick={copyKey}>Copy {kind} key</button>
	{#if onDismiss}<button type="button" class="button quiet" onclick={onDismiss}>I have saved this key</button>{/if}
	<p class="copy-status" class:copy-failed={copyFailed} role="status" aria-live="polite">{copyMessage}</p>
</div>

<style>
	.plaintext-reveal { padding: 1.25rem; border: 1px solid #a6ced8; border-radius: var(--radius); background: #edf7f9; margin-block: 1.5rem; }
	strong { font-size: 1rem; }
	p { color: var(--color-text-muted); font-size: 0.9rem; line-height: 1.6; margin: 0.6rem 0 1rem; }
	code { display: block; overflow-wrap: anywhere; padding: 1rem; margin-bottom: 1rem; background: white; border: 1px solid var(--color-border); border-radius: 6px; font-family: var(--font-mono); font-size: 0.85rem; user-select: all; }
	.copy-status { margin: 0.75rem 0 0; min-height: 1.4em; }
	.copy-failed { color: #983535; }
</style>
