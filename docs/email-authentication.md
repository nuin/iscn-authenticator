# Email account access

The hosted Pages application uses email codes at `/signup`, `/login` and
`/recover`. The Deno application's independent account system is unchanged.
Email is delivered from `iscn@bioinformat.org` through the private `iscn-email`
Worker. [Email operations](email.md) describes its bindings and delivery evidence.

## Customer behavior

- Signup sends a verification code. It creates the account only after proof of
  email ownership. An existing address opens its existing account after verification.
- Login sends a sign-in code. It never creates an account for an unknown address.
- Recovery sends a recovery code. On verification it invalidates other browser
  sessions and pending email challenges, then starts a new session. For previously verified accounts, subscription,
  usage and integration keys are preserved. Suspected API-key compromise requires
  separate revocation under API access.
- All codes expire after ten minutes, accept at most five attempts and work only
  in the browser that requested them. Resending replaces that browser's previous
  challenge. The UI supports password-manager code autofill and ordinary HTML forms.
- Request responses do not disclose whether an account exists. Login/recovery for
  an unknown email send a code but cannot grant access; after proving ownership,
  the user must create an account. No marketing or welcome messages are sent.
- Losing access to the inbox requires operator identity review. There is no
  automatic email change, alternative-address reset or recovery bypass.

## Security and storage

`0003_email_auth.sql` adds three tables without changing or deleting existing user,
billing or usage data. Email addresses are trimmed and lowercased for matching.
Ambiguous legacy addresses fail closed; operators must investigate duplicates
without blindly merging subscriptions or account data.

An eight-digit code uses rejection-sampled Web Crypto randomness. D1 stores an
HMAC-SHA-256 digest keyed by the `EMAIL_AUTH_SECRET` deployment secret, with the
random 256-bit browser challenge token included in its input. The token itself
is stored only in a Secure, HttpOnly, SameSite=Lax cookie; D1 stores its SHA-256
digest. Neither token nor code appears in a URL. A D1 batch atomically increments
attempts, consumes a successful challenge once, verifies ownership, applies
credential revocations and creates a session. Concurrent submissions cannot
create multiple sessions. Errors roll back all those state changes. Session and
email-verification status are read in one database snapshot. New API-key inserts
require that the authorizing session still exists; billing redirects recheck the
session after provider responses to avoid disclosing credentials after recovery.

Delivery must return HTTP 202 before a challenge becomes usable. Provider failure
or timeout invalidates it and returns a generic failure. There are no automatic
retries after an ambiguous delivery outcome. Error logs contain an event and
request ID, not email addresses, codes, credentials or provider exception text.

Sending reservations are atomic across all purposes and browsers:

| Scope | Maximum | Window starting at first request |
|---|---:|---:|
| Email | 1 | 60 seconds |
| Email | 5 | 1 hour |
| Client address | 20 | 1 hour |
| Entire service | 1,000 | 24 hours |

The client address comes from SvelteKit's Cloudflare adapter, not a submitted
form field. Email and client-address limit keys are hashed. Failed provider sends
still count; rejected reservations do not partially consume other limits.
Cloudflare account sending quotas apply independently. Expired challenges and
rate-limit rows are lazily removed in batches of 100 on subsequent requests;
expiry is enforced even if no cleanup request occurs. Auth forms have an 8 KiB
body limit, SvelteKit's Origin checks, and private/no-store response headers.

## Existing accounts

Old `iscn_live_` website account keys no longer authenticate. Old sessions cannot
access the dashboard until email ownership is verified. At first verification,
all pre-verification sessions and keys (including API keys) are retired, so a
person who registered another person's address cannot retain access. Users must
create replacement integration keys after that first verification. Later normal
sign-ins retain other sessions; recovery explicitly replaces them. Account IDs,
paid plans, subscription periods and usage totals remain unchanged.

## Deployment and rollback

1. Deploy the private mailer and verify its service binding as in `email.md`.
2. Create a cryptographically random secret of at least 32 bytes and provision
   `EMAIL_AUTH_SECRET` with `wrangler pages secret put --project-name iscn-web`.
   Feed it securely via stdin or a secret manager; never commit or log it. Configure
   production and any preview environment intended for real sign-ins separately.
3. Apply `migrations/0003_email_auth.sql` to the production D1 database before
   deploying the Pages build. The migration can be reapplied safely.
4. Run `npm run check`, `npm run build`, `npm test`, `npm run test:browser` and
   `aislop scan -d .` from the appropriate repository directories.
5. Deploy Pages and exercise signup, logout/login and recovery with an authorized
   inbox. Confirm receipt and complete verification in the same browser. Never
   ask a customer to send their code to an operator or chat assistant.

The test mail-capture Worker exists only in `tests/helpers`, is started on local
ephemeral ports, and is never a production binding or route. Tests use temporary
D1 databases and a temporary `.dev.vars` secret; no real email is sent.

Rotating `EMAIL_AUTH_SECRET` invalidates pending codes, not existing sessions.
If a deployment fails, fix forward or restore a version that retains email
ownership checks. Rolling back to account-key-only signup would reintroduce the
unverified-account vulnerability. Keep the additive tables during rollback.

Delivery to the owner's verified destination has been confirmed. Customer
delivery additionally depends on Cloudflare sender-domain onboarding and account
limits; verify a customer inbox before declaring arbitrary-recipient delivery
proven. No price, quota purchase or paid checkout is enabled by this auth change.
