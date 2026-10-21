<script lang="ts">
  import { enhance } from '$app/forms';
  import KeyReveal from '#lib/components/account/KeyReveal.svelte';
  import type { ActionData, PageData } from './$types';
  let { data, form }: { data: PageData; form: ActionData } = $props();
  let dismissed = $state<string | null>(null);
  const secret = $derived(form?.plaintext && form.plaintext !== dismissed ? form.plaintext : null);
  const activeKeys = $derived(data.keys.filter((key) => key.revoked_at === null).length);
  const date = (value: number) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(value * 1000);
  const example = $derived(`curl --fail-with-body '${data.apiBase}/validate' \\\n  -H "Authorization: Bearer $ISCN_API_KEY" \\\n  -H 'Content-Type: application/json' \\\n  -d '{"karyotype":"47,XX,+21[5]/46,XX[10]"}'`);
</script>

<svelte:head><title>API access · ISCN Authenticator</title></svelte:head>
<header class="page-heading">
  <p class="section-label">Laboratory integrations</p><h1>API access</h1>
  <p>Connect your laboratory workflow to the same notation checks and coverage notes you see in the browser.</p>
</header>

<section class="panel allowance" aria-labelledby="allowance-heading">
  <div class="section-heading"><h2 id="allowance-heading">{data.usage ? 'Current subscription allowance' : 'No active API subscription'}</h2><a href="/dashboard/billing">Billing →</a></div>
  {#if data.usage}
    <p class="usage-value">{data.usage.remaining.toLocaleString('en')} <span>validations remaining</span></p>
    <progress value={data.usage.used} max={data.usage.limit} aria-label="Subscription allowance used"></progress>
    <p>{data.usage.used.toLocaleString('en')} of {data.usage.limit.toLocaleString('en')} used. Period ends {date(data.usage.period_end)} UTC.</p>
  {:else}
    <p>You can prepare integration keys now. Validation requests require an active paid subscription. Pricing and checkout will appear when available.</p>
  {/if}
  <p class="muted">All integration keys share one allowance and a limit of 60 validations per minute. There are no automatic overage charges. Browser checks remain free.</p>
</section>

{#if form?.message}<p class="notice" role="status">{form.message}</p>{/if}
{#if secret}<KeyReveal plaintext={secret} kind="API" onDismiss={() => { dismissed = secret; }} />{/if}

<section aria-labelledby="keys-heading" class="keys-section">
  <div class="section-heading"><h2 id="keys-heading">Integration keys</h2><span class="muted">{activeKeys} / 10 active</span></div>
  <p class="muted">These keys authenticate API requests. Use <a href="/dashboard/keys">account keys</a> to sign in to the website.</p>
  <form method="POST" action="?/create" use:enhance class="create-key">
    <label for="api-key-label">Key label<input id="api-key-label" name="label" placeholder="Laboratory LIMS" required maxlength="80" /></label>
    <button class="button" disabled={Boolean(secret) || activeKeys >= 10}>Create API key</button>
  </form>
  {#if secret}<p class="muted">Save and dismiss the new key before changing your keys.</p>{/if}
  <div class="key-list">
    {#each data.keys as key (key.id)}
      <article class="panel key-record">
        <div><h3>{key.label}</h3><p class="muted">{key.revoked_at ? 'Revoked' : 'Active'}</p><p>Created {date(key.created_at)} UTC<br />Last API validation: {key.last_used_at ? `${date(key.last_used_at)} UTC` : 'Not used yet'}</p></div>
        {#if !key.revoked_at}<form method="POST" action="?/revoke" use:enhance><input type="hidden" name="key_id" value={key.id} /><button class="button quiet" disabled={Boolean(secret)} aria-label={`Revoke ${key.label}`}>Revoke key</button></form>{/if}
      </article>
    {:else}<p class="notice">No integration keys yet. Create a separate key for each service that calls the API.</p>{/each}
  </div>
</section>

<section class="panel quickstart" aria-labelledby="quickstart-heading">
  <p class="section-label">First request</p><h2 id="quickstart-heading">Check a karyotype from your server</h2>
  <p>Set <code>ISCN_API_KEY</code> in your server environment. Keep keys out of browser scripts and shared notebooks.</p>
  <pre><code>{example}</code></pre>
  <p>HTTP 200 means the check completed. Read <code>status</code>, <code>result.errors</code>, and <code>coverage</code> before accepting a result.</p>
  <div class="guide-links"><a href="/docs/hosted-api">API guide →</a><a href="/api/v1/openapi.json" download="iscn-api-openapi.json">Download OpenAPI</a></div>
</section>

<style>
  .allowance, .quickstart { padding: clamp(1.25rem, 3vw, 2rem); }
  .section-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 1rem; }
  h2 { font-size: 1.1rem; margin: 0 0 0.75rem; }
  p { font-size: 0.88rem; line-height: 1.75; }
  .muted { color: var(--color-text-muted); font-size: 0.8rem; }
  .usage-value { font-size: 2rem; font-weight: 600; margin-bottom: 0.5rem; }
  .usage-value span { font-size: 0.9rem; font-weight: 400; }
  progress { width: 100%; accent-color: var(--color-primary); }
  .keys-section { margin-block: 2rem; }
  .create-key { display: flex; flex-wrap: wrap; gap: 1rem; align-items: end; margin-block: 1.25rem; }
  label { flex: 1; min-width: 180px; font-size: 0.85rem; }
  input { display: block; width: 100%; margin-top: 0.5rem; padding: 0.8rem; border: 1px solid var(--color-border); border-radius: 5px; font: inherit; }
  .key-list { display: grid; gap: 0.75rem; }
  .key-record { padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  h3 { margin: 0; font-size: 0.95rem; overflow-wrap: anywhere; }
  .key-record p { font-size: 0.75rem; margin: 0.4rem 0 0; }
  pre { overflow-x: auto; padding: 1.25rem; background: #102c37; color: #e4f4f6; border-radius: 6px; font-size: 0.75rem; line-height: 1.8; }
  code { font-family: var(--font-mono); }
  .guide-links { display: flex; flex-wrap: wrap; gap: 1.5rem; font-size: 0.85rem; }
</style>
