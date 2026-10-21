<script lang="ts">
  import { enhance, type SubmitFunction } from '$app/forms';
  import AccountAccess from './AccountAccess.svelte';

  let { mode, pending, form }: {
    mode: 'signup' | 'login' | 'recover';
    pending: { email: string } | null;
    form?: { error?: string; sent?: boolean; email?: string; reset?: boolean } | null;
  } = $props();
  let busy = $state(false);
  const address = $derived(form?.sent && form.email ? form.email : pending?.email);
  const checkingCode = $derived(Boolean(address));
  const heading = $derived(mode === 'signup' ? 'Create an account' : mode === 'recover' ? 'Recover your account' : 'Welcome back');
  const description = $derived(mode === 'signup'
    ? 'Verify your email to open your laboratory workspace. No payment details required.'
    : mode === 'recover' ? 'Verify your email to regain access and sign out other browser sessions.'
    : 'Enter your email and we’ll send a one-time sign-in code. No password or account key needed.');
  const submit: SubmitFunction = () => {
    busy = true;
    return async ({ update }) => {
      try {
        await update();
      } finally { busy = false; }
    };
  };
</script>

<svelte:head><title>{checkingCode ? 'Check your email' : heading} · ISCN Authenticator</title></svelte:head>

<AccountAccess>
  <p class="section-label">{mode === 'signup' ? 'Create your workspace' : 'Account access'}</p>
  <h1>{checkingCode ? 'Check your email' : heading}</h1>
  {#if checkingCode}
    <p class="muted">Enter the eight-digit code sent to <strong>{address}</strong>.</p>
    <p class="help">It expires after ten minutes. Use this browser to finish. If you request another code here, use the newest email.</p>
  {:else}
    <p class="muted">{description}</p>
  {/if}
  {#if form?.error}<p class="notice form-error" role="alert">{form.error}</p>{/if}
  {#if form?.sent && checkingCode}<p class="sr-only" role="status">Code sent. Check your inbox and spam folder.</p>{/if}

  {#if checkingCode}
    <form method="POST" action="?/verify" use:enhance={submit}>
      <label for="code">Email code</label>
      <input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern={'[0-9]{8}'} minlength="8" maxlength="8" placeholder="00000000" spellcheck="false" required aria-describedby="code-help" />
      <p id="code-help" class="help">Never share this code. Bioinformat will never ask you to send it to support.</p>
      <button type="submit" class="button" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Verify email and continue' : mode === 'recover' ? 'Recover account' : 'Sign in'}</button>
    </form>
    <div class="resend">
      <form method="POST" action="?/request" use:enhance={submit}>
        <input type="hidden" name="email" value={address} />
        <button type="submit" class="button quiet" disabled={busy}>Send another code</button>
      </form>
      <p class="help">Check spam first. Wait at least one minute between requests.</p>
      <form method="POST" action="?/change" use:enhance={submit}>
        <button type="submit" class="text-button" disabled={busy}>Use a different email</button>
      </form>
    </div>
  {:else}
    <form method="POST" action="?/request" use:enhance={submit}>
      <label for="email">Email</label>
      <input id="email" name="email" type="email" value={address ?? ''} autocomplete="email" spellcheck="false" maxlength="254" placeholder="you@laboratory.org" required />
      <button type="submit" class="button" disabled={busy}>{busy ? 'Sending…' : 'Send email code'}</button>
    </form>
  {/if}

  {#if mode === 'recover'}
    <p class="help">For verified accounts, recovery keeps your subscription and API integrations. If you can’t access your inbox, contact <a href="mailto:iscn@bioinformat.org">iscn@bioinformat.org</a>; changing the account email requires identity review.</p>
    <p><a href="/login">Back to sign in</a></p>
  {:else if mode === 'signup'}
    <p class="account-switch">Already have an account? <a href="/login">Sign in</a>.</p>
    <p class="help">By creating an account, you agree to the <a href="/terms">terms of use</a>. Read our <a href="/privacy">privacy notice</a>.</p>
  {:else}
    <p class="account-switch">New to ISCN Authenticator? <a href="/signup">Create an account</a>.</p>
    <p class="help"><a href="/recover">Recover access and sign out other sessions</a>.</p>
  {/if}
  <p class="help">Previously used an account key? Your first email verification retires old sessions and keys, including API keys. Your subscription is preserved. <a href="/docs/accounts-and-keys#existing-accounts">Migration details</a>.</p>
  <a class="public-link" href="/validate">Review one karyotype without an account →</a>
</AccountAccess>

<style>
  h1 { font-size: clamp(1.75rem, 3vw, 2.25rem); letter-spacing: -0.035em; margin: 0.75rem 0 1rem; }
  p { line-height: 1.65; }
  strong { overflow-wrap: anywhere; }
  form { display: grid; gap: 0.6rem; margin-top: 1.75rem; }
  input:not([type='hidden']) { width: 100%; min-width: 0; padding: 0.8rem 0.9rem; background: white; border: 1px solid var(--color-border); border-radius: 6px; font: inherit; }
  #code { font-family: var(--font-mono); letter-spacing: 0.25em; font-size: 1.4rem; }
  .help { color: var(--color-text-muted); font-size: 0.85rem; }
  form > .button { width: 100%; margin-top: 0.75rem; }
  .button:disabled { opacity: 0.65; cursor: wait; }
  .resend form { margin-top: 0.5rem; }
  .text-button { border: 0; background: none; color: var(--color-primary); font: inherit; font-size: 0.85rem; text-decoration: underline; padding: 0; cursor: pointer; }
  .account-switch { margin-top: 1.75rem; font-size: 0.9rem; }
  .public-link { display: block; padding-top: 1.5rem; border-top: 1px solid var(--color-border); font-size: 0.85rem; }
  .form-error { color: #983535; margin-top: 1.25rem; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
