# Compliance templates — ISCN Authenticator

> **LEGAL REVIEW REQUIRED.** The documents in this directory are starting
> points, not contracts. No file here is fit to sign until a qualified
> attorney has reviewed and edited it for the jurisdiction, counter-party,
> and workload in question. Anyone who signs an unreviewed template owns
> the downstream risk personally.

## Why these exist

ISCN Authenticator is a SaaS that validates karyotype strings against the
ISCN 2024 grammar. The service itself does not, in normal use, process
Protected Health Information (PHI) — karyotype nomenclature is a
structural description of chromosomal state, not a direct identifier.

However:

- Customers **may** transmit karyotypes alongside PHI through adjacent
  systems. Some of those customers will ask us to sign a Business
  Associate Agreement (BAA) before integrating.
- Life-sciences-adjacent buyers (clinical labs, pharma, biotech) often
  require qualification evidence (IQ / OQ / PQ) and a SOC2 story before
  they will procure.
- Several prospective customers ask for a privacy policy and SaaS terms
  tailored to the product before they will sign.

These templates give a starting position for all of the above, written
specifically around what ISCN Authenticator actually does (no karyotype
content in logs, structured error codes, customer-owned API keys, Stripe
billing, Axiom log retention).

## Files

| File | Purpose |
|------|---------|
| `baa_template.md` | HIPAA Business Associate Agreement (HHS model-based). |
| `iq_template.md` | Installation Qualification checklist — env vars, KV, webhooks, logs. |
| `oq_template.md` | Operational Qualification test matrix — auth, rate limit, quota, error shapes. |
| `pq_template.md` | Performance Qualification — SLOs, uptime, retention evidence. |
| `soc2_evidence_outline.md` | Mapping of SOC2 Trust Services Criteria to repo artifacts. |
| `privacy_policy_template.md` | Public privacy notice. |
| `terms_template.md` | SaaS terms of service. |

## How to use

1. Copy the template to a working document outside the repository.
2. Replace every `<FILL-IN>` marker with the correct text for the deal.
3. Send to legal counsel for review.
4. Do **not** check the signed version back into this repository —
   signed agreements should live in the customer-relationship system
   (Salesforce, HubSpot, or equivalent), not in source control.

## Maintenance

When the product changes in a way that touches any compliance claim
(new data flow, new processor, new log destination, new auth mechanism,
change of hosting region), update the affected templates in the same
pull request. Reviewers should block merges that introduce a compliance
mismatch.
