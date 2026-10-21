<svelte:head><title>Account access · ISCN Authenticator</title></svelte:head>
<header class="page-heading">
  <p class="section-label">Your account</p>
  <h1>Account access</h1>
  <p>Sign in with a one-time code sent to your verified email. You no longer need an account key.</p>
</header>
<section class="panel access-panel">
  <h2>Recover access or sign out other sessions</h2>
  <p>Request a recovery code and enter it in the same browser. Recovery starts a new session and signs out your other browsers. Your subscription and existing API integrations are preserved.</p>
  <a href="/recover" class="button">Recover account access</a>
</section>
<section class="panel access-panel">
  <h2>Keep integrations separate</h2>
  <p>API keys are for laboratory systems. Manage them on the <a href="/dashboard/api">API access page</a>. They cannot sign you in to this website.</p>
  <p>For accounts created before email verification was introduced, the first email verification retires old sessions and keys, including API keys. Create replacement integration keys after verifying.</p>
  <a href="/docs/accounts-and-keys">Read the account guide →</a>
</section>
<style>
  .access-panel { padding: 1.75rem; margin-bottom: 1.5rem; }
  h2 { font-size: 1.15rem; }
  p { line-height: 1.7; color: var(--color-text-muted); }
</style>
