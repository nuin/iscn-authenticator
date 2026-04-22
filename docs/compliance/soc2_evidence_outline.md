# SOC 2 evidence outline — ISCN Authenticator

> **LEGAL / AUDIT REVIEW REQUIRED.** This outline maps SOC 2 Trust
> Services Criteria (TSC) to concrete artifacts already produced by the
> ISCN Authenticator codebase and operational practice. It is a
> starting point for conversations with an auditor, not a completed
> audit report.

## Scope

- **Service:** ISCN Authenticator SaaS (validate, signup, dashboard,
  billing).
- **Report type expected:** SOC 2 Type I initially; Type II after a
  six-month observation window of operating effectiveness.
- **Trust Services Criteria in scope:** Security (CC1–CC9). Availability
  is claimed when the PQ window demonstrates it. Confidentiality,
  Processing Integrity, and Privacy are **not** claimed in this outline
  but may be added once customer demand justifies the audit cost.

## Control mapping

### CC1 — Control environment

| Control | Evidence |
|---------|----------|
| CC1.1 Organizational integrity | Company policies in `docs/policies/` (to be authored before audit); signed code of conduct. |
| CC1.2 Board oversight | Not applicable pre-seed; documented when first board meeting occurs. |
| CC1.3 Roles and responsibilities | `README.md` maintainer list; GitHub CODEOWNERS. |
| CC1.4 Competence | Engineer onboarding runbook (`docs/runbook/onboarding.md`, to be written). |
| CC1.5 Accountability | Commit history in `git log`; pull request review records in GitHub. |

### CC2 — Communication and information

| Control | Evidence |
|---------|----------|
| CC2.1 Internal communication | #incidents Slack channel archives; status page entries. |
| CC2.2 External communication | Public status page; security.txt on the website. |
| CC2.3 Information quality | This repository's `docs/` tree is the authoritative product description. |

### CC3 — Risk assessment

| Control | Evidence |
|---------|----------|
| CC3.1 Objectives | Quarterly OKR document (out-of-repo). |
| CC3.2 Risk identification | Threat model in `docs/security/threat-model.md` (to be authored). |
| CC3.3 Fraud risk | Stripe's own fraud controls; we do not store card data. |
| CC3.4 Change in environment | PR template requires "security considerations" section (to be added). |

### CC4 — Monitoring activities

| Control | Evidence |
|---------|----------|
| CC4.1 Ongoing evaluation | Axiom dashboards for 5xx rate and latency; alerts on breach. |
| CC4.2 Deficiency evaluation | Incident post-mortems filed in `docs/incidents/`. |

### CC5 — Control activities

| Control | Evidence |
|---------|----------|
| CC5.1 Selection of controls | This document. |
| CC5.2 Technology controls | CI pipeline: `fmt`, `lint`, `check`, `test` gates in `.github/workflows/ci.yml`. |
| CC5.3 Policy deployment | Documented operational runbooks in `docs/admin.md`. |

### CC6 — Logical and physical access

| Control | Evidence |
|---------|----------|
| CC6.1 Logical access provisioning | API keys are customer-owned, SHA-256 hashed at rest; plaintext shown once at creation; admin CLI in `deno/admin.ts` gated behind local filesystem access. |
| CC6.2 Credential management | Key rotation endpoint `POST /keys/rotate`; revoke CLI `keys:revoke`. |
| CC6.3 Role-based access | Session cookies scoped to a single `customer_id`; dashboard routes cannot read other customers' keys. |
| CC6.6 Network boundary | Deno Deploy enforces TLS 1.2+ at the edge; CSP and security headers set in `deno/lib/middleware.ts`. |
| CC6.7 Data-in-transit encryption | TLS on all ingress and egress (Stripe, Axiom). |
| CC6.8 Malicious software prevention | Deno's permission model (no filesystem or network access beyond explicit allowlist); dependencies pinned via `deno.lock`. |

### CC7 — System operations

| Control | Evidence |
|---------|----------|
| CC7.1 Vulnerability management | `deno task check` + `lint` on every PR; dependabot equivalent via Deno's pinned `jsr:` specifiers. |
| CC7.2 Monitoring | Axiom dataset records every request with status, duration, route, key_id (hashed), request_id; alerts on 5xx spike. |
| CC7.3 Incident response | `docs/runbook/incident-response.md` (to be authored); PagerDuty or equivalent rotation. |
| CC7.4 Incident communication | Status page entries; post-mortems. |

### CC8 — Change management

| Control | Evidence |
|---------|----------|
| CC8.1 Change authorization | Pull request + review; required CI checks; branch protection on `master`. |
| CC8.2 Change testing | Unit tests (`deno/tests/`), fixture-driven validity tests (`tests/test_fixtures.py`), integration tests in `integration_test.ts`. |
| CC8.3 Change deployment | Deno Deploy auto-deploys `master`; rollback by redeploying a prior commit SHA. |

### CC9 — Risk mitigation

| Control | Evidence |
|---------|----------|
| CC9.1 Vendor management | Sub-processor list maintained in `docs/compliance/baa_template.md` § 4; separate BAAs with hosting and log processor. |
| CC9.2 Business continuity | Stateless validation path; KV is the only state; KV backups per hosting provider SLA. |

## Product-specific notes

- **Data classification.** The validation pipeline is stateless with
  respect to karyotype content. Default log schema does **not** include
  the karyotype string; enabling payload logging requires an explicit
  operator action and is documented in `docs/admin.md`.
- **PHI handling.** ISCN nomenclature is not, by itself, PHI. When a
  customer elects to transmit karyotypes alongside PHI through adjacent
  systems, the signed BAA governs the relationship.
- **Card data.** Cardholder data is never seen by this service. Stripe
  Checkout and the Stripe Billing Portal are hosted by Stripe; we
  receive only the Stripe customer and subscription identifiers.

## Gaps to close before a Type II audit

1. Author `docs/policies/` tree (information-security, acceptable-use,
   incident-response, vendor-management).
2. Author `docs/security/threat-model.md`.
3. Author `docs/runbook/incident-response.md`.
4. Stand up a status page and on-call rotation.
5. Accumulate six months of Axiom evidence covering SLOs in § PQ.
6. Formal access-review cadence (quarterly) for any production human
   access.
