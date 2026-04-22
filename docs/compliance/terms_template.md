# Terms of Service (template) — ISCN Authenticator

> **LEGAL REVIEW REQUIRED.** This template is a starting point for the
> SaaS Terms of Service that govern customer use of ISCN Authenticator.
> It has not been reviewed by an attorney and is not binding until
> adopted and accepted by each party.

_Last updated: `<YYYY-MM-DD>`_

## 1. The agreement

These Terms of Service (the "Terms") form a binding agreement between
`<COMPANY_LEGAL_NAME>` ("ISCN Authenticator", "we", "us") and the
customer identified in the signup flow ("Customer", "you"). By
creating an account or calling the ISCN Authenticator API, you agree
to these Terms. If you do not agree, do not use the service.

## 2. The service

ISCN Authenticator is an API-first SaaS that validates karyotype
strings against the ISCN 2024 grammar and returns structured
validation results. A reference client surface and a browser dashboard
are available for account administration. The service does not provide
medical advice and is not a diagnostic device.

## 3. Account and eligibility

- You must be at least the age of majority in your jurisdiction.
- You are responsible for the accuracy of the information you provide.
- You are responsible for all activity under your account, including
  for any users or systems to which you issue API keys.
- You must not use the service if you are barred from doing so under
  the laws of your jurisdiction or ours.

## 4. Plans, fees, and billing

- Free tier: `<MONTHLY_QUOTA_FREE>` validation requests per calendar
  month. No card required.
- Paid tiers: current pricing is listed at
  `<PRICING_URL>`. Paid subscriptions renew monthly until cancelled.
- Billing is processed by Stripe, Inc. By subscribing, you authorize
  recurring charges to your payment method for the selected plan.
- Taxes, where applicable, are your responsibility unless we are
  required to collect them.
- Quota overages return `HTTP 402 quota_exceeded` rather than billing
  you for additional usage. To raise your quota you must upgrade your
  plan.
- Fees are non-refundable except where required by law or explicitly
  stated.

## 5. Acceptable use

You must not:

- Use the service to process data you do not have the right to process.
- Attempt to circumvent authentication, rate limits, or monthly
  quotas.
- Reverse engineer the service beyond what applicable law allows.
- Resell access to the service or expose our API to third parties as a
  direct replacement without a written resale agreement.
- Use the service in a safety-critical context without an independent
  expert review of the validation output.
- Transmit unlawful, infringing, or malicious content.

We may rate-limit, suspend, or terminate access in response to
credible violations.

## 6. Customer data

- You retain all rights in the data you submit.
- You grant us a limited licence to process submitted data solely to
  operate the service, secure it, and improve reliability.
- By default we do not log karyotype payloads. If you require
  payload-inclusive logging for your own compliance needs, it must be
  enabled under a separate written arrangement (including a BAA if
  PHI is involved).
- If you process Protected Health Information through adjacent
  systems, a Business Associate Agreement (`docs/compliance/baa_template.md`)
  must be executed before you send us any PHI.

## 7. Service levels and availability

We target the service levels documented in our Performance
Qualification record (`docs/compliance/pq_template.md`). These targets
are commitments to ourselves for planning; specific contractual SLAs,
where offered, will be set out in a separate order form signed by both
parties.

Planned maintenance will be announced in advance via
`<STATUS_PAGE_URL>`.

## 8. Security

We implement administrative, physical, and technical safeguards
described in our security documentation and compliance templates. You
are responsible for protecting your API keys and session cookies and
for notifying us promptly if you suspect they have been compromised.

## 9. Suspension and termination

- You may cancel at any time from the dashboard. Cancellation takes
  effect at the end of the current billing period.
- We may suspend or terminate access for material breach of these
  Terms with written notice and a reasonable opportunity to cure,
  except where the breach involves ongoing harm.
- On termination, your data will be deleted in accordance with the
  retention periods in our privacy policy, subject to legal
  obligations to retain it longer.

## 10. Warranties and disclaimers

The service is provided "as is" and "as available". To the fullest
extent permitted by law, we disclaim all warranties, express or
implied, including merchantability, fitness for a particular purpose,
non-infringement, and accuracy of validation results. You are solely
responsible for the interpretation and clinical application of any
output of the service.

## 11. Limitation of liability

To the fullest extent permitted by law, our aggregate liability for
any claims arising out of or related to these Terms or the service is
limited to the fees you paid to us in the 12 months preceding the
claim. We are not liable for indirect, incidental, special,
consequential, or punitive damages, or for lost profits or data,
however caused.

## 12. Indemnification

You will defend and indemnify us against third-party claims arising
from your violation of these Terms, your use of the service in
violation of law, or your infringement of third-party rights.

## 13. Changes

We may update these Terms from time to time. Substantive changes will
be announced at least 30 days in advance via email or the dashboard.
Continued use after the effective date constitutes acceptance.

## 14. Governing law and disputes

These Terms are governed by the laws of `<STATE_OR_COUNTRY>`, without
regard to conflict-of-laws principles. The parties submit to the
exclusive jurisdiction of the courts located in `<VENUE>` for any
dispute not subject to a separate arbitration clause in an executed
order form.

## 15. Contact

`<COMPANY_LEGAL_NAME>`
`<ADDRESS>`
`<LEGAL_CONTACT_EMAIL>`
