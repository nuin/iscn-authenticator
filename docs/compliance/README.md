# Compliance and qualification templates

These files are **unreviewed drafting aids**. They are not executed agreements,
completed qualification records, certification evidence, or a statement that
ISCN Authenticator meets a regulatory framework. Their existence does not make
the product suitable for a particular laboratory workflow.

The templates predate the current split between the hosted Cloudflare Pages app
and the optional Deno service. Claims about quotas, log retention, infrastructure,
billing, support, and data handling must be checked against the actual deployment.
Do not publish or sign a template without the relevant legal and operational review.

## Contents

| File | Drafting purpose |
|---|---|
| [baa_template.md](baa_template.md) | Business Associate Agreement discussion draft |
| [iq_template.md](iq_template.md) | Installation qualification record structure |
| [oq_template.md](oq_template.md) | Operational qualification test structure |
| [pq_template.md](pq_template.md) | Performance qualification record structure |
| [soc2_evidence_outline.md](soc2_evidence_outline.md) | Suggested evidence organization; not an audit report |
| [privacy_policy_template.md](privacy_policy_template.md) | Privacy notice discussion draft |
| [terms_template.md](terms_template.md) | Service terms discussion draft |

## Establish the actual scope first

- Browser validation runs locally. Account and billing actions contact services.
- Deno and Python HTTP integrations send input to the deployed service.
- Data classification depends on what is supplied and the surrounding workflow.
  Do not assume that removing a direct identifier settles that classification.
- A configured log sink does not, by itself, establish retention, contractual
  obligations, or compliance. Record the actual configuration and agreements.
- Test results demonstrate only the checks and environments exercised. The
  validator has known coverage gaps, described in the [coverage guide](https://iscn-web.pages.dev/docs/coverage).

## Use and maintain a template

1. Copy the selected template into the organization's controlled drafting system.
2. Replace placeholders and remove claims that do not apply to the deployment.
3. Link each retained operational claim to current evidence and an accountable owner.
4. Obtain the required legal, security, quality, and operational review.
5. Store reviewed or executed records in the appropriate controlled record system,
   not in this public source repository.

Reassess the documents after changes to hosting, processors, data flows, retention,
authentication, billing, or product scope. The [launch-readiness checklist](../launch-readiness.md)
tracks unresolved product and operational decisions without treating these drafts
as completed evidence.
