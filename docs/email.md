# Hosted email operations

The ISCN contact address is `iscn@bioinformat.org`. Cloudflare Email Routing
forwards it to the owner's existing verified destination. The existing
`info@bioinformat.org` rule is separate. Review destination addresses in the
Cloudflare dashboard; do not publish the owner's personal inbox in customer docs.

## Sending architecture

The `iscn-email` Worker sends transactional messages through Cloudflare's native
`EMAIL` binding. The Pages project connects to it through the private `MAILER`
service binding. The sender and Reply-To are fixed to `iscn@bioinformat.org`.
There is no public Worker URL, route, preview URL, SMTP password or API token
stored in the application. Do not expose the Worker through a public proxy.

Signup, sign-in and recovery use eight-digit codes sent by this private service.
No account or session is created before verification. Pages supplies fixed
message templates; browser input cannot choose the subject or body.
See the [account authentication guide](email-authentication.md) for the lifecycle,
migration behavior, rate limits and deployment procedure.

Cloudflare's [Email Sending documentation](https://developers.cloudflare.com/email-service/get-started/send-emails/)
describes domain activation. Sending to arbitrary customers requires Workers Paid
and an onboarded sender domain. A successful send to an account's verified
destination alone does not establish that arbitrary-recipient sending is enabled.
Check the domain's sending status, authentication records and account limits
before enabling customer messages.

## Private service contract

`GET /health` reports that the Worker is running, without sending mail or claiming
deliverability. `POST /send` requires JSON with exactly these fields:

| Field | Requirement |
|---|---|
| `to` | One email address, at most 254 characters; no address arrays or headers |
| `subject` | Nonempty string, at most 200 characters; no control characters |
| `text` | Required nonempty plain text, at most 12,000 characters |
| `html` | Optional HTML, at most 16,000 characters |

Requests are limited to 32 KiB, including streamed bodies. Compressed requests,
attachments, sender overrides and additional fields are rejected.

Server-side callers can use the binding directly:

```ts
const response = await env.MAILER.fetch('https://mailer.internal/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: recipient, subject, text, html }),
});
```

The URL selects a route within the bound Worker; it does not require a public DNS
record. HTTP 202 returns `{request_id, message_id, status: "accepted"}` after
Cloudflare accepts the message. Acceptance does not prove inbox delivery.
HTTP 400/413/415 indicate invalid input; HTTP 502 indicates a sending failure.
Provider errors return a request ID without exposing recipient or message content.
The Worker does not log payloads, store messages or retry sends. Do not blindly
retry a timed-out send: its delivery outcome may be unknown.

## Deploy and check

Run from `packages/web` using the existing project-local Wrangler installation:

```bash
npm run types:email
npm run types:cloudflare
npm run check
npm test
npm run deploy:email -- --dry-run
npm run deploy:email
npm run build
npx wrangler d1 execute iscn-db --remote --file migrations/0003_email_auth.sql
# Provision EMAIL_AUTH_SECRET once before enabling email authentication.
npx wrangler pages deploy .svelte-kit/cloudflare --project-name iscn-web --branch master
```

Deploy the mail Worker before the Pages app so its service binding resolves.
Binding type freshness is checked in CI. Local email simulation does not send
messages. Only use `remote: true` in a temporary development configuration when
the recipient and real delivery test have been authorized. The installed local
runtime supports compatibility dates through 2026-10-19; a temporary local
probe can pass `--compatibility-date 2026-10-19` while production uses its declared
2026-10-21 date.

Inspect the domain and forwarding configuration without sending messages:

```bash
npx wrangler email routing rules list bioinformat.org
npx wrangler email routing addresses list
npx wrangler email sending list bioinformat.org
npx wrangler email sending dns get bioinformat.org
```

For sending failures, use the request ID and Cloudflare Email Service activity
log. Verify the sender domain, SPF/DKIM/DMARC, suppression status and account
limits. Do not log verification links, recovery tokens, account keys, API keys or
laboratory records. Transactional email must not contain karyotypes or patient data.

## Setup evidence — 2026-10-21

- The `ISCN support` forwarding rule was created and reread as enabled. Its
  destination is the existing verified inbox approved by the owner.
- The owner reported Email Sending enabled in the dashboard. Wrangler's email
  management endpoints still returned `2036 Unauthorized` after OAuth refresh,
  and the REST send command returned authentication error `10000`.
- A temporary native Worker binding, restricted to the approved verified
  destination, accepted one real test email and returned a provider message ID.
  No customer data or credentials were included. The owner confirmed receipt in
  the inbox. No automatic resends were performed.
- The private `iscn-email` Worker was deployed and its `/health` route was checked
  through a remote service binding. It returned `status: "running"`.
- Email verification, sign-in and recovery now have local Worker/D1 integration
  and browser tests. Arbitrary-recipient inbox delivery remains a separate live
  operational check; the verified-destination test above does not prove it.
