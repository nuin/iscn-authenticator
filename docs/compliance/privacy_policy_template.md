# Privacy policy (template) — ISCN Authenticator

> **LEGAL REVIEW REQUIRED.** This is a plain-language starting point.
> It has not been reviewed by an attorney and is not suitable for
> publication as-is. Jurisdictional privacy law (GDPR, CCPA, PIPEDA,
> state-level US laws) will alter disclosures, legal bases, and
> cross-border transfer language.

_Last updated: `<YYYY-MM-DD>`_

## Who we are

ISCN Authenticator is operated by `<COMPANY_LEGAL_NAME>`
("ISCN Authenticator", "we", "us"). Our registered address is
`<ADDRESS>`. You can reach us at `<PRIVACY_CONTACT_EMAIL>`.

## What the service does

ISCN Authenticator is an API that validates karyotype strings against
the ISCN 2024 nomenclature grammar. A karyotype string describes the
structural state of a set of chromosomes. It is a scientific
description, **not** a direct identifier of an individual.

## What we collect

We collect the following categories of data in order to operate the
service:

1. **Account data.** The email address you provide at signup, and
   metadata about your plan and usage.
2. **Authentication data.** API keys you create. Keys are stored as
   salted SHA-256 hashes; the plaintext value is shown once at
   creation and never again.
3. **Request metadata.** For each API request: timestamp, route,
   response status, duration, a hashed key identifier, your IP
   address, and a request identifier. By default we **do not** log
   the karyotype string itself.
4. **Billing data.** If you upgrade to a paid plan, Stripe stores your
   card details on our behalf. We receive only the Stripe customer
   identifier, subscription identifier, plan, and payment status.
5. **Cookies.** A single HMAC-signed session cookie (`iscn_session`)
   for authenticated dashboard access. We do not use third-party
   advertising cookies.

We do **not** intentionally collect:

- Karyotype payload contents in our persistent logs.
- Cardholder data (Stripe is the data controller for payment cards).
- Cross-site tracking identifiers.

## Why we collect it

| Purpose | Legal basis (where applicable) |
|--------|-------------------------------|
| Provide the validation service | Contract (our Terms of Service) |
| Authenticate requests and prevent abuse | Legitimate interest; contract |
| Bill for paid usage | Contract; legal obligation (tax) |
| Debug service issues and meet SLOs | Legitimate interest |
| Respond to legal or regulatory requests | Legal obligation |

## How long we keep it

| Category | Retention |
|---------|-----------|
| Account data | Until the account is deleted, plus up to 30 days in backups. |
| API keys (hashed) | Until revoked, plus up to 30 days in backups. |
| Request metadata in Axiom | 12 months, then deleted. |
| Stripe billing data | As long as required by tax and financial regulation in `<JURISDICTION>`. |
| Support correspondence | 24 months from last contact. |

## Who we share it with

We use the following sub-processors. Each is bound by a separate
agreement, and we list them so you can exercise your rights.

| Sub-processor | Role | Data shared |
|--------------|------|-------------|
| `<HOSTING_PROVIDER>` | Compute and Deno KV storage | Account data, request metadata, hashed API keys |
| `<LOG_PROCESSOR>` | Request log retention | Request metadata |
| Stripe, Inc. | Payment processing | Email, plan, Stripe customer and subscription ids |

We do not sell your personal data. We do not share your data with
advertisers.

## Your rights

Depending on where you live, you may have the right to:

- Access the personal data we hold about you.
- Correct inaccurate personal data.
- Delete your personal data ("right to be forgotten").
- Object to, or restrict, specific processing.
- Port your personal data to another provider.
- Lodge a complaint with a supervisory authority.

To exercise any of these rights, email
`<PRIVACY_CONTACT_EMAIL>`. We will respond within the timeframe
required by applicable law (typically 30 days).

## International transfers

Data may be processed in `<PRIMARY_REGION>` and, for sub-processors, in
the jurisdictions listed above. Where transfers occur outside the
European Economic Area or the United Kingdom, we rely on the European
Commission's Standard Contractual Clauses and supplementary measures as
appropriate.

## Security

We protect your data with:

- TLS 1.2+ for all network traffic.
- Hashed, salt-protected API keys at rest.
- Role-based administrative access to the underlying key-value store.
- Request logs that exclude karyotype payload content by default.
- Rate limiting and monthly quota enforcement to bound abuse.

No method of transmission or storage is perfectly secure; we cannot
guarantee absolute security.

## Changes to this policy

We will post the updated version here and, where changes are
substantive, notify you by email. The "Last updated" date at the top of
this page reflects the latest change.

## Contact

`<PRIVACY_CONTACT_EMAIL>`
`<COMPANY_LEGAL_NAME>`, `<ADDRESS>`
