# Business Associate Agreement (Template)

> **LEGAL REVIEW REQUIRED.** This template is derived from the US
> Department of Health & Human Services (HHS) model BAA language. It has
> not been reviewed by an attorney and is not a legally binding document
> until signed by authorized representatives of both parties.

This Business Associate Agreement (the "Agreement") is entered into as
of `<EFFECTIVE_DATE>` (the "Effective Date") by and between:

- **Covered Entity:** `<COVERED_ENTITY_LEGAL_NAME>`, a
  `<ENTITY_TYPE>` organized under the laws of `<STATE>`, with its
  principal place of business at `<ADDRESS>` ("Covered Entity"), and
- **Business Associate:** `<BUSINESS_ASSOCIATE_LEGAL_NAME>`, a
  `<ENTITY_TYPE>` organized under the laws of `<STATE>`, with its
  principal place of business at `<ADDRESS>` ("Business Associate").

Together, Covered Entity and Business Associate are referred to as the
"Parties."

## 1. Definitions

Capitalized terms used but not otherwise defined in this Agreement have
the meaning assigned to them in the Health Insurance Portability and
Accountability Act of 1996 ("HIPAA"), the Health Information Technology
for Economic and Clinical Health Act of 2009 ("HITECH"), and
implementing regulations at 45 C.F.R. Parts 160 and 164 (the "HIPAA
Rules"), as amended.

Without limiting the foregoing, "Protected Health Information" or "PHI"
has the meaning set forth in 45 C.F.R. § 160.103 and, for purposes of
this Agreement, refers to PHI that Business Associate creates, receives,
maintains, or transmits on behalf of Covered Entity.

## 2. Permitted Uses and Disclosures

Business Associate may use or disclose PHI only:

1. To perform the services described in the underlying services
   agreement between the Parties (the "Services Agreement"), which for
   ISCN Authenticator consists of validating karyotype strings against
   the ISCN 2024 nomenclature specification and returning structured
   validation results.
2. As required by law (45 C.F.R. § 164.502(a)(1)).
3. For the proper management and administration of Business Associate,
   provided that disclosures are made only if required by law or the
   recipient provides reasonable written assurances of confidentiality
   and breach notification.
4. To provide data aggregation services relating to Covered Entity's
   health care operations, if requested in writing.

Business Associate will not use or disclose PHI in any manner that would
violate the HIPAA Rules if done by Covered Entity, unless a specific
exception applies under 45 C.F.R. § 164.504(e)(2)(i).

## 3. Safeguards

Business Associate will implement and maintain administrative, physical,
and technical safeguards that reasonably and appropriately protect the
confidentiality, integrity, and availability of electronic PHI ("ePHI"),
as required by 45 C.F.R. §§ 164.308, 164.310, 164.312, and 164.316.

Product-specific safeguards currently in place:

- API authentication via per-customer bearer tokens (SHA-256 hashed
  at rest; plaintext never stored or logged).
- Token-bucket rate limiting and monthly quota enforcement to bound
  request volume.
- Transport encryption (TLS 1.2+) for all inbound and outbound
  requests.
- Structured request logs that **do not** contain karyotype payloads
  by default; log retention is governed by the log processor
  (`<LOG_PROCESSOR_NAME>`) under a separate BAA.
- Role-based administrative access to the underlying key-value store
  (Deno KV) via platform IAM.

## 4. Subcontractors

Business Associate will enter into a written agreement with each
subcontractor that creates, receives, maintains, or transmits PHI on its
behalf, binding the subcontractor to materially the same restrictions
and conditions that apply to Business Associate under this Agreement.

Current subcontractors with PHI access (where applicable):

| Subcontractor | Role | BAA status |
|--------------|------|------------|
| `<HOSTING_PROVIDER>` | Compute + Deno KV storage | `<BAA_STATUS>` |
| `<LOG_PROCESSOR_NAME>` | Log retention | `<BAA_STATUS>` |

Billing is processed by Stripe, Inc.; Stripe does not receive PHI and is
not listed as a Business Associate.

## 5. Reporting

Business Associate will report to Covered Entity:

- Any use or disclosure of PHI not permitted by this Agreement, in
  writing, without unreasonable delay and no later than `<N>` calendar
  days after discovery.
- Any Security Incident (45 C.F.R. § 164.304) of which it becomes
  aware, consistent with 45 C.F.R. § 164.410.
- Any Breach of Unsecured PHI within `<N>` calendar days of discovery,
  including the information required under 45 C.F.R. § 164.410(c).

Notices under this section go to: `<COVERED_ENTITY_NOTICE_CONTACT>`.

## 6. Access, Amendment, and Accounting

Where Business Associate maintains PHI in a Designated Record Set,
Business Associate will:

- Provide access to such PHI within `<N>` calendar days of a request
  under 45 C.F.R. § 164.524.
- Make amendments to such PHI as directed by Covered Entity under
  45 C.F.R. § 164.526.
- Document and provide an accounting of disclosures under
  45 C.F.R. § 164.528.

For ISCN Authenticator specifically, the Designated Record Set is
limited to the request metadata retained in the log processor; the
validation service is stateless with respect to karyotype content
(see § 3).

## 7. Termination

Either Party may terminate this Agreement for material breach of the
other Party that is not cured within `<N>` calendar days of written
notice. Upon termination, Business Associate will return or destroy all
PHI in its possession and retain no copies, except where infeasible, in
which case Business Associate will extend the protections of this
Agreement to the PHI and limit further uses and disclosures to those
purposes that make return or destruction infeasible.

## 8. Miscellaneous

- **Amendment.** The Parties will amend this Agreement as reasonably
  necessary to comply with changes in the HIPAA Rules.
- **Interpretation.** Any ambiguity will be resolved in favor of a
  meaning that permits compliance with the HIPAA Rules.
- **No Third-Party Beneficiaries.** Nothing in this Agreement confers
  rights on any person other than the Parties.
- **Governing Law.** This Agreement is governed by the laws of
  `<STATE>`, without regard to conflict-of-laws principles.
- **Entire Agreement.** This Agreement, together with the Services
  Agreement, constitutes the entire agreement between the Parties with
  respect to the subject matter and supersedes all prior writings.

## Signatures

**Covered Entity:** `<COVERED_ENTITY_LEGAL_NAME>`

- Signature: _______________________________
- Name: `<SIGNATORY_NAME>`
- Title: `<SIGNATORY_TITLE>`
- Date: `<DATE>`

**Business Associate:** `<BUSINESS_ASSOCIATE_LEGAL_NAME>`

- Signature: _______________________________
- Name: `<SIGNATORY_NAME>`
- Title: `<SIGNATORY_TITLE>`
- Date: `<DATE>`
