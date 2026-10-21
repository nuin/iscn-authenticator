# Laboratory launch readiness

This document records decisions and evidence needed before offering a commercial
laboratory service. An unchecked item is not a claim that the work is complete.
Owners should replace the role labels below with named accountable people and
link the resulting evidence in their controlled release record.

## Current product boundary

The Pages app provides browser checks, example explanations, report QC, FISH
construction, a selected-category CNV evidence worksheet, D1 accounts and keys,
and signed-in browser batch review. Review worksheets use explicit local downloads.
It also exposes a subscription-gated hosted customer API with dedicated integration
keys and aggregate period usage. It has no saved validation history or team roles. Deno is a separate
self-hosted runtime with its own keys and quotas. Checkout remains unavailable
until price, currency and included volume are approved and the required Stripe
Price/credentials are configured. See [hosted API setup](hosted-api.md).

Core checks have known gaps: unknown abnormalities may pass, ordering multiple
abnormal clones needs context, accepted assay modifiers are retained without full checking, and
count ranges do not receive composition/coherence checks. Their ordering and positive
integer bounds are checked. The interface must keep
these limits visible; a passing result is not certification or report approval.

## Owner decisions and evidence

The owner supplied **Bioinformat** as the seller/business name on 2026-10-19.
It is identified in the website footer, About page and service description.
The ISCN support address is `iscn@bioinformat.org`, with Cloudflare forwarding
configured on 2026-10-21. See [email operations](email.md) for delivery evidence
and remaining customer-email checks. Support commitments, subscription price,
legal entity details and jurisdiction remain open. This name alone does not enable paid checkout.

| Decision or evidence | Accountable role | Completion criterion |
|---|---|---|
| Commercial packaging and price | Product owner | Written price, included features, eligibility, and exclusions match implemented behavior |
| Seller identity and jurisdiction | Business owner | Legal entity and required public contact information reviewed and recorded |
| Support channel and commitments | Operations owner | A real monitored contact, escalation process, and only commitments the team can meet |
| Terms, privacy, refunds, cancellation | Legal/business owner | Reviewed documents for the actual service; no template placeholders or invented policies |
| Stripe environment and price | Billing owner | Correct account, price, secrets, callback origin, and webhook configuration |
| Subscription lifecycle | Engineering/billing owners | Checkout, event replay, cancellation, and payment-failure evidence from the configured environment |
| Laboratory acceptance scope | Laboratory/quality owner | Representative cases, known failures, coverage exclusions, and review procedure documented |
| Data handling and retention | Security/operations owners | Actual data map, processor configuration, access controls, and retention/deletion process recorded |
| Account recovery | Product/security owners | Email-code recovery is implemented; exercise delivery to a customer inbox and establish an operator identity-review process for lost inbox access |
| Incident response and deployment recovery | Operations owner | Named responders, monitoring, rollback procedure, and exercised recovery steps |
| HTTP service, if sold | Product/engineering owners | Deployed origin, service-specific keys, limits, monitoring, integration docs, and operating commitments |
| Evidence and claims review | Release owner | Public statements trace to current functionality or reviewed evidence |

## Release gate

- [ ] Confirm the intended release, deployed commit, environment, and core/fixture versions.
- [ ] Run type, build, integration, browser, and quality checks; retain their results.
- [ ] Check single results, unknown input, multiple cell lines, count ranges, and assay modifiers.
- [ ] Verify browser checks make no request containing entered notation or its signature.
- [ ] Exercise 500/501-entry batches and inspect CSV/JSON downloads, including formula-like inputs.
- [ ] Exercise report-total mismatches, conclusion conflicts, prior/current comparisons and input edits after review.
- [ ] Check FISH reporting modes, exact cutoff equality, protocol provenance and worksheet export.
- [ ] Adjudicate supported CNV score cases and excluded evidence; verify incomplete assessments suppress classification.
- [ ] Retain local review exports under the laboratory procedure; do not describe them as authenticated signatures or immutable history.
- [ ] Test keyboard use and narrow screens, including documentation search and navigation.
- [ ] Save a signup key before continuing; test sign-in, key creation, revocation, and sign-out.
- [ ] Confirm unavailable billing stays unavailable when secrets are absent.
- [ ] If enabling paid checkout, complete the configured billing lifecycle checks above.
- [ ] Check documentation links, service origins, credential boundaries, and nullable response fields.
- [ ] Review public terms and privacy copy against the actual deployment and owner decisions.
- [ ] Confirm support and incident contacts are real before publishing them.

## Evidence boundaries

Repository compliance templates are drafting aids. They are not an executed BAA,
an audit, a qualification result, or a certification. Do not claim medical
approval, clinical efficacy, a guaranteed support response time, or a hosting
retention period without an applicable reviewed basis.

The hosted API adds server processing and aggregate usage to the browser-only
validation boundary; its data flow and billing lifecycle require launch evidence.
Team permissions, persisted result history or additional data flows would expand it further. Treat those as new implementation and review
work, not as features implied by an existing account or a `pro` database value.
