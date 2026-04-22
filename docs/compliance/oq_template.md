# Operational Qualification (OQ) — ISCN Authenticator

> **LEGAL / QA REVIEW REQUIRED.** This template defines the functional
> test matrix used to demonstrate that an installed ISCN Authenticator
> environment operates according to its specification. It becomes
> binding evidence only once executed, evidenced (screenshots, logs,
> commit SHA, dataset snapshots), and signed off.

## 1. Document control

| Field | Value |
|------|-------|
| Product | ISCN Authenticator |
| Version under test | `<GIT_SHA_OR_TAG>` |
| Environment | `<VALIDATION | STAGING | PRODUCTION>` |
| Executor | `<NAME / ROLE>` |
| Reviewer | `<NAME / ROLE>` |
| Date executed | `<YYYY-MM-DD>` |
| Related IQ | `<LINK_OR_ID>` |
| Related PQ | `<LINK_OR_ID>` |

## 2. Scope

OQ tests cover:

- Authentication (API key and session) — valid, invalid, revoked.
- Rate limiting — under, at, and over the token-bucket threshold.
- Monthly quota — under, at, and over the tier limit.
- Error-code contract — shape, fields, and HTTP status.
- Structured request logging — emitted per request, free of karyotype
  payloads by default.
- Stripe webhook idempotency and signature verification.
- Key lifecycle — create, rotate, revoke.

Out of scope: validation-rule correctness (covered by the fixture-driven
unit test suite), sustained-load performance (PQ).

## 3. Test matrix

Each row is an independent, repeatable test. Record Pass/Fail with a
reference to the evidence artifact (log ID, screenshot filename, or
Axiom query link).

### 3.1 Authentication

| # | Precondition | Action | Expected | Result | Evidence |
|---|--------------|--------|----------|--------|----------|
| A1 | Valid, active API key | `GET /validate?karyotype=46,XX` with `Authorization: Bearer <key>` | 200, `valid=true` | ☐ | |
| A2 | No `Authorization` header | Same request | 401, `error: "unauthenticated"` | ☐ | |
| A3 | Malformed bearer token | `Authorization: Bearer not-a-key` | 401, `error: "unauthenticated"` | ☐ | |
| A4 | Revoked API key | `GET /validate` with revoked key | 401, `error: "unauthenticated"` | ☐ | |
| A5 | Valid session cookie | `GET /dashboard` | 200, HTML dashboard | ☐ | |
| A6 | Expired session cookie | `GET /dashboard` | 303 to `/login` | ☐ | |

### 3.2 Rate limiting (token bucket)

| # | Precondition | Action | Expected | Result | Evidence |
|---|--------------|--------|----------|--------|----------|
| R1 | Fresh bucket (full) | Single request | 200, `X-RateLimit-Remaining` = burst − 1 | ☐ | |
| R2 | Drain burst | Fire `burst` requests back to back | All 200 | ☐ | |
| R3 | One more after drain | Next request | 429, `error: "rate_limited"`, `Retry-After` ≥ 1 | ☐ | |
| R4 | Refill window | Wait 60/refill-rate s, retry | 200 | ☐ | |

### 3.3 Monthly quota

| # | Precondition | Action | Expected | Result | Evidence |
|---|--------------|--------|----------|--------|----------|
| Q1 | Counter = 0, free tier | Single validate | 200, `X-Monthly-Quota-Remaining` = free − 1 | ☐ | |
| Q2 | Counter = limit − 1, free | Validate | 200, remaining = 0 | ☐ | |
| Q3 | Counter = limit, free | Validate | 402, `error: "quota_exceeded"` | ☐ | |
| Q4 | Tier upgraded to pro mid-month | Validate | 200, limit now pro | ☐ | |
| Q5 | Grandfathered key (`customer_id` null) | Validate | 200; no quota headers block request | ☐ | |

### 3.4 Error-code contract

For each error below, verify the response body has the shape
`{ "error": "<code>", "message": "<string>" }` and the HTTP status
matches. No stack traces, no secrets.

| # | Endpoint | Scenario | Status | Code | Result | Evidence |
|---|---------|----------|--------|------|--------|----------|
| E1 | `/validate` | missing karyotype query | 400 | `invalid_request` | ☐ | |
| E2 | `/validate` | bad method (POST) | 405 | `method_not_allowed` | ☐ | |
| E3 | `/usage` | bad method (POST) | 405 | `method_not_allowed` | ☐ | |
| E4 | `/signup` | duplicate email | 400 | `invalid_signup` | ☐ | |
| E5 | `/billing/webhook` | missing signature | 400 | `stripe_error` | ☐ | |
| E6 | any | server fault (simulated) | 500 | `internal_error` | ☐ | |

### 3.5 Logging

| # | Action | Expected | Result | Evidence |
|---|--------|----------|--------|----------|
| L1 | Single `/validate` request | One NDJSON line in Axiom within 2 min, fields: `ts`, `route`, `status`, `duration_ms`, `key_id` (hashed), `ip`, `request_id` | ☐ | |
| L2 | Inspect payload | Log line does **not** contain the karyotype string | ☐ | |
| L3 | Simulate Axiom outage (invalid token) | Request still returns 200; failure written to stderr, not retried synchronously | ☐ | |

### 3.6 Stripe webhook

| # | Action | Expected | Result | Evidence |
|---|--------|----------|--------|----------|
| W1 | Valid `checkout.session.completed` | 200; customer tier = `pro`; subscription record created; `stripe_events:<id>` marker present | ☐ | |
| W2 | Replay of the same event | 200; state unchanged | ☐ | |
| W3 | Tampered body, valid header | 400 `stripe_error`; idempotency marker NOT written | ☐ | |
| W4 | Missing `Stripe-Signature` header | 400 `stripe_error` | ☐ | |
| W5 | `invoice.payment_failed` | 200; customer `status = past_due` | ☐ | |
| W6 | `customer.subscription.deleted` | 200; customer `tier = free`, `status = cancelled` | ☐ | |

### 3.7 Key lifecycle

| # | Action | Expected | Result | Evidence |
|---|--------|----------|--------|----------|
| K1 | `POST /signup` with new email | 200; customer + first key created; plaintext returned once | ☐ | |
| K2 | `POST /keys/rotate` with current key | 200; new key issued; old key immediately rejected on next request | ☐ | |
| K3 | Admin CLI `keys:revoke <id>` | Key rejected on next request (401) | ☐ | |

## 4. Deviations and resolutions

| # | Description | Resolution | Approver |
|---|-------------|------------|----------|
|   |             |            |          |

## 5. Sign-off

- Executor: _________________________  Date: `<YYYY-MM-DD>`
- QA reviewer: _______________________  Date: `<YYYY-MM-DD>`
