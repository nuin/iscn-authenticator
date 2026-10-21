# Paid validation API implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a documented customer API with subscription-gated access, leaving commercial activation pending the user's later pricing decision.

**Architecture:** Add SvelteKit API handlers to the existing Pages Worker and store integration keys, Stripe entitlements and usage in its existing D1 database. Reconcile entitlements in the signed webhook transaction. Use an atomic conditional upsert to enforce shared limits; keep validator semantics unchanged.

**Tech Stack:** Existing SvelteKit, Cloudflare Pages/D1, Web Crypto, TypeScript core, Stripe REST, Node SQLite tests and Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-paid-validation-api.md`

## Global Constraints

- Price/currency/volume are explicitly deferred; never create charges or enable an invented offering.
- Preserve `.cairn` and all unrelated changes; use current feature branch and existing Pages project.
- No changes to aislop rules or thresholds, no new runtime dependencies, no validation-semantics change.
- Keys are integration-only; browser validation never calls the hosted API.
- Limits: 4096 characters, 16384 body bytes, 60 requests per fixed minute, ten active integration keys per account.

## Review Focus

- A renewal webhook must not reset already-consumed units in the same period; duplicate and stale events must not restore canceled access.
- A request racing revocation, expiry or quota consumption must never obtain an uncounted paid result.
- Integration keys must not become account credentials; cookies and account keys must not grant API access.
- Malformed or incomplete Stripe Price/period data must never activate an offering or unbounded entitlement.
- Partial-coverage notation and invalid later cell lines must return the same result and review status as the browser.

### Task 1: Paid endpoint, entitlement and usage enforcement

**Files:** Add `packages/web/migrations/0001_validation_api.sql`; server modules under `packages/web/src/lib/server/validation-api/` for keys, usage, HTTP handling, input and OpenAPI; `packages/web/src/lib/server/api-offering.ts`; routes under `packages/web/src/routes/api/v1/`; corresponding `packages/web/tests/validation-api*.test.mjs`. Modify Stripe parsing/billing reconciliation, schema test initialization and webhook fixtures.

**Interfaces:**
- Consumes `reviewKaryotype(string)`, `getValidationCoverage(ast)`, `D1Database`, existing signed Stripe webhook flow.
- Produces `createIntegrationKey(db, userId, label)`, `listIntegrationKeys(db, userId)`, `revokeIntegrationKey(db, userId, keyId)`; `getApiOffering(secretKey, priceId)`; `handleValidationApi(request, db, operation)` for validate/usage; D1 entitlement and usage tables.

- [ ] Add failing tests for the public route's JSON authentication error, exclusive integration credentials, strict envelopes, streamed-size limits and coverage parity. Observe missing endpoint failure against the current Pages build.
- [ ] Add failing signed-webhook tests for explicit paid entitlement, missing price metadata/periods, trialing exclusion, expiry, cancellation and renewal without usage reset. Observe absent entitlement failure.
- [ ] Add schema migration and focused modules. Bind all SQL values. Consume units atomically only after valid envelope/auth/subscription checks; include key and entitlement validity in the write predicate. Keep aggregate usage per account and subscription period.
- [ ] Implement Stripe Price and subscription-item parsing. Reconcile active entitlement in the same transaction as account/processed-event changes. Preserve prior unrelated-event and rollback behavior.
- [ ] Add concurrent quota/rate/key-cap, cross-account revocation, renewal and credential-isolation tests. Exercise local SQLite and built Pages routes, including the 90-case corpus without altering clinical semantics.
- [ ] Run `npm run check`, `npm run build`, `npm test`; expected all green. Commit Task 1 and record its test evidence.

### Task 2: Customer workflow, documentation and release

**Files:** Add `/dashboard/api/+page.server.ts` and `+page.svelte`, API guide in `packages/web/src/lib/docs/`, browser API workflow tests and `docs/hosted-api.md`. Update dashboard navigation, integration/account/data-handling guides, pricing, billing and descriptive privacy/terms copy.

**Interfaces:**
- Consumes Task 1 key management, API offering and usage functions and database tables.
- Produces customer create/copy/revoke flow, usage display, curl/Python examples and downloadable OpenAPI specification. Existing `/dashboard/keys` remains account-only.

- [ ] Add a failing browser test for the API dashboard link and create/revoke workflow; verify absent page/control failure.
- [ ] Implement the dashboard and one-time secret display; retain the secret through enhanced-form success until dismissed, never expose a hash or another customer's key. Gate checkout on a valid configured Price and show its currency, amount and included volume.
- [ ] Document request/response shapes, status vs coverage, authentication, period resets, counting, retry policy, no overages, expiry, privacy and setup. Replace obsolete claims that the website has no API. Include price metadata and additive migration instructions.
- [ ] Run web check/build, `npm test`, browser suite, visual inspection and `aislop scan -d .`; expected no new errors or warnings. Commit Task 2 and record evidence.
- [ ] Obtain one fresh final review of this change, address important findings with regression tests, then commit/push and deploy the additive migration and Pages build. Verify public API JSON errors/spec and documented activation-pending state live. Do not fabricate paid production access for testing.
