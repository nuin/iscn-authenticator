# Performance Qualification (PQ) — ISCN Authenticator

> **LEGAL / QA REVIEW REQUIRED.** PQ demonstrates that ISCN
> Authenticator performs within its declared service levels under
> representative production conditions over a sustained window. This
> document is a template; an execution becomes evidence only when the
> measurement window, datasets, and sign-offs are filled in.

## 1. Document control

| Field | Value |
|------|-------|
| Product | ISCN Authenticator |
| Version under test | `<GIT_SHA_OR_TAG>` |
| Environment | `<PRODUCTION>` |
| Measurement window | `<YYYY-MM-DD .. YYYY-MM-DD>` |
| Executor | `<NAME / ROLE>` |
| Reviewer | `<NAME / ROLE>` |
| Related IQ | `<LINK_OR_ID>` |
| Related OQ | `<LINK_OR_ID>` |

## 2. Service level objectives (SLOs)

The product is qualified against the following SLOs. Each must be met
over the measurement window.

| SLO | Target | Source of truth |
|-----|--------|-----------------|
| Monthly availability of `/validate` | ≥ 99.5 % | Uptime probe + Deno Deploy status |
| P50 latency of `/validate` | ≤ 50 ms | Axiom `duration_ms` quantile |
| P95 latency of `/validate` | ≤ 150 ms | Axiom `duration_ms` quantile |
| P99 latency of `/validate` | ≤ 400 ms | Axiom `duration_ms` quantile |
| 5xx rate | ≤ 0.1 % of requests | Axiom `status >= 500` / total |
| Stripe webhook processing success | ≥ 99.9 % | Axiom route = `/billing/webhook` |
| Log delivery to Axiom within 2 min | ≥ 99.0 % | Axiom dashboard builtin latency |

## 3. Measurement method

- **Traffic source:** real customer traffic for the declared window.
  Synthetic load tests run in staging only; they do not count toward
  production PQ evidence.
- **Latency percentiles:** calculated from `duration_ms` in Axiom over
  the full window. Attach the query used (`<AXIOM_QUERY_URL>`).
- **Availability:** 1 − (minutes of probe failure ÷ total minutes).
  Planned maintenance with a pre-approved change ticket is excluded from
  the denominator.
- **5xx rate:** `count(status >= 500) / count(all)` over the window.
- **Evidence retention:** 12 months in Axiom, with a static export
  attached to this qualification record.

## 4. Results

| SLO | Target | Observed | Pass/Fail | Evidence |
|-----|--------|----------|-----------|----------|
| Availability | ≥ 99.5 % | `<value>` | ☐ | |
| P50 latency | ≤ 50 ms | `<value>` | ☐ | |
| P95 latency | ≤ 150 ms | `<value>` | ☐ | |
| P99 latency | ≤ 400 ms | `<value>` | ☐ | |
| 5xx rate | ≤ 0.1 % | `<value>` | ☐ | |
| Webhook success | ≥ 99.9 % | `<value>` | ☐ | |
| Log delivery | ≥ 99.0 % | `<value>` | ☐ | |

## 5. Incident review

List every incident, post-mortem, or SEV reported during the
measurement window, even if it did not breach an SLO.

| Ticket | Window | Severity | Root cause | Corrective action |
|--------|--------|----------|------------|-------------------|
|        |        |          |            |                   |

## 6. Retention evidence

- [ ] Axiom dataset retention is ≥ 12 months (confirmed via dashboard
      screenshot attached).
- [ ] Stripe events are retained by Stripe for the required period; no
      PHI is stored in Stripe metadata.
- [ ] Deno KV `stripe_events:*` markers have a 7-day TTL (idempotency
      window only; not a billing record).
- [ ] Deno KV `usage:*` counters have ≥ 40-day TTL covering month
      rollover.
- [ ] Signed legal documents (BAAs, DPAs) are stored in the customer
      relationship system, not the repository.

## 7. Review cadence

PQ is re-executed:

- Quarterly as a rolling 30-day window against live data.
- After any change that materially affects availability or latency
  (runtime upgrade, hosting region move, new log processor).
- After any SLO breach, as part of the post-mortem action items.

## 8. Deviations and resolutions

| # | Description | Resolution | Approver |
|---|-------------|------------|----------|
|   |             |            |          |

## 9. Sign-off

- Executor: _________________________  Date: `<YYYY-MM-DD>`
- QA reviewer: _______________________  Date: `<YYYY-MM-DD>`
- Product owner: _____________________  Date: `<YYYY-MM-DD>`
