# Installation Qualification (IQ) — ISCN Authenticator

> **LEGAL / QA REVIEW REQUIRED.** This checklist is a template for the
> installation qualification of an ISCN Authenticator deployment. It is
> not a completed qualification until every item is executed, evidenced,
> and signed off by the responsible engineer and QA reviewer.

## 1. Document control

| Field | Value |
|------|-------|
| Product | ISCN Authenticator |
| Version under test | `<GIT_SHA_OR_TAG>` |
| Environment | `<PRODUCTION | STAGING | VALIDATION>` |
| Executor | `<NAME / ROLE>` |
| Reviewer | `<NAME / ROLE>` |
| Date executed | `<YYYY-MM-DD>` |
| Related OQ | `<LINK_OR_ID>` |

## 2. Scope

This IQ verifies that a specific deployment of ISCN Authenticator has
been installed correctly into the target environment and is ready for
operational qualification. It covers:

- Required environment variables
- Deno KV (or compatible store) provisioning
- Stripe webhook endpoint registration
- Log sink (Axiom) connectivity
- Baseline health endpoint response
- A single authenticated request against `/validate`

Out of scope: functional correctness of validation rules (OQ), SLO and
sustained-load behaviour (PQ).

## 3. Prerequisites

- [ ] Approved change ticket `<CHANGE_ID>` linked.
- [ ] Deployment artifact SHA matches the one in the change ticket.
- [ ] Secrets available in the target environment's secret manager,
      *not* in the repository.
- [ ] Rollback plan documented (previous `<GIT_SHA>` and redeploy
      procedure).

## 4. Environment variables

Record the presence (not the value) of each required variable.

| Variable | Required in prod | Present? | Notes |
|----------|------------------|----------|-------|
| `KV_PATH` or managed Deno KV binding | yes | ☐ | |
| `SESSION_SECRET` | yes | ☐ | ≥ 32 bytes of entropy |
| `RATE_LIMIT_PER_MIN` | no | ☐ | default 60 |
| `RATE_LIMIT_BURST` | no | ☐ | default 2× refill |
| `MONTHLY_QUOTA_FREE` | no | ☐ | default 10 000 |
| `MONTHLY_QUOTA_PRO` | no | ☐ | default 1 000 000 |
| `STRIPE_SECRET_KEY` | yes | ☐ | `sk_live_*` for prod |
| `STRIPE_WEBHOOK_SECRET` | yes | ☐ | `whsec_*` |
| `STRIPE_PRICE_ID_PRO` | yes | ☐ | `price_*` |
| `PUBLIC_BASE_URL` | yes | ☐ | e.g. `https://iscn.example.com` |
| `AXIOM_API_TOKEN` | yes in prod | ☐ | |
| `AXIOM_DATASET` | yes in prod | ☐ | |
| `DENO_ENV` | yes | ☐ | = `production` |

## 5. Deno KV provisioning

- [ ] KV is reachable from the runtime (either Deno Deploy-managed
      binding or a persistent `KV_PATH` for self-hosted).
- [ ] Read/write smoke test succeeded (see § 9).
- [ ] Backup/retention policy documented in the runbook.

## 6. Stripe webhook

- [ ] Endpoint `https://<host>/billing/webhook` is registered in the
      Stripe Dashboard under the correct account mode (test / live).
- [ ] Subscribed events: `checkout.session.completed`,
      `customer.subscription.updated`,
      `customer.subscription.deleted`,
      `invoice.payment_failed`.
- [ ] Signing secret in the Stripe Dashboard matches
      `STRIPE_WEBHOOK_SECRET` in the deployment env.
- [ ] First real or simulated event reached the endpoint with
      HTTP 200 and an idempotency marker in KV.

## 7. Axiom log sink

- [ ] Axiom dataset `<AXIOM_DATASET>` exists and is owned by the
      ISCN Authenticator team.
- [ ] Test ingest via `curl` with `AXIOM_API_TOKEN` returned
      HTTP 2xx.
- [ ] At least one request-log entry from the deployment is visible
      in the Axiom dataset within 2 minutes of generating traffic.

## 8. Health endpoint

- [ ] `GET /health` returns HTTP 200 with body `{"status":"ok"}`
      within 1 second.
- [ ] Response includes no secrets, stack traces, or PHI.

## 9. Smoke test: authenticated validate

Execute the following against the installed environment (admin-owned
test customer and key used; do not use a real customer account):

```bash
curl -sS -H "Authorization: Bearer $TEST_KEY" \
  "$PUBLIC_BASE_URL/validate?karyotype=46,XX"
```

Verify:

- [ ] HTTP status `200`.
- [ ] Response body contains `"valid": true`.
- [ ] Response headers include `X-RateLimit-Limit`,
      `X-RateLimit-Remaining`, `X-Monthly-Quota-Limit`,
      `X-Monthly-Quota-Remaining`, `X-Monthly-Quota-Reset`.
- [ ] A matching log line appears in Axiom within 2 minutes.

## 10. Deviations and resolutions

| # | Description | Resolution | Approver |
|---|-------------|------------|----------|
|   |             |            |          |

## 11. Sign-off

By signing below, the executor attests that each checklist item above
was carried out and the results match the expected outcome (or an
approved deviation is recorded in § 10).

- Executor: _________________________  Date: `<YYYY-MM-DD>`
- QA reviewer: _______________________  Date: `<YYYY-MM-DD>`
