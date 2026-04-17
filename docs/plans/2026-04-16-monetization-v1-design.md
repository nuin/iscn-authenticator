# ISCN Authenticator — Monetization v1 Design

**Date:** 2026-04-16
**Status:** Design approved, ready for planning
**Scope:** v1 = Free tier + Pro tier ($29/mo). Team/Research/Enterprise tiers deferred.

## Context

The ISCN Authenticator currently exists as three implementations: a Python library (`iscn_authenticator/`), a FastAPI server (`api/`), and a Deno/TypeScript port (`deno/`). All three validate ISCN 2024 karyotype strings. The project has no monetization and no public deployment.

The goal is to turn the existing work into a self-sustaining product without compromising the open-source core, without taking on regulatory obligations the author cannot meet, and without over-building.

## Strategic Decisions (locked before design)

| Decision | Choice | Implication |
|---|---|---|
| Audience | Clinical labs + researchers; vendors later | Single-user UX first, not multi-tenant enterprise |
| Channel | Author's lab access + researcher contacts | Direct validation with ≥1 pilot user possible |
| Regulatory posture | Productivity tool, not diagnostic/CDS | No FDA, no IVDR; explicit "not for diagnostic use" ToS |
| Product shape | Open-core library + hosted SaaS (self-host later) | OSS library is the funnel, hosted app is the revenue |
| v1 scope | Lean wedge: Free + Pro only | Validates willingness to pay before Team/Research complexity |
| Deployment | Cloudflare (Pages, Workers, D1, R2, KV) | TypeScript port becomes the primary runtime |
| Domain | `iscn.bioinformat.com` | Subdomain leverages existing domain authority |

## Architecture

### Packages

1. **`@iscn/core` (npm, MIT-licensed, OSS)** — Promoted from the existing `deno/lib/` TypeScript implementation. Zero Node dependencies; runs in browsers, Workers, Deno, and Node. Contains the parser, rule engine, `KaryotypeAST`, and the new Explain module. Source of truth for validation behavior.

2. **`iscn-authenticator` (PyPI, MIT-licensed, OSS, secondary)** — Existing Python package, kept in sync with `@iscn/core` via a shared fixture corpus. Secondary artifact for Python users (bioinformatics pipelines, Jupyter). Not on the critical path for the hosted product.

3. **`iscn-web` web application (source-available, not OSS)** — SvelteKit app deployed to Cloudflare Pages + Workers at `iscn.bioinformat.com`. Imports `@iscn/core` for client-side validation. Server routes handle auth, Stripe, persistence.

4. **`api/` FastAPI server (MIT-licensed, OSS, deferred)** — Kept in-repo for Python users and for the later enterprise self-host appliance. Not part of the Cloudflare deployment.

### Validation runs client-side

All validation executes in the browser via `@iscn/core`. No karyotype string is sent to the server for the free tier at any point. Pro's batch feature also validates in the browser; the server only persists the raw CSV (opt-in) and metadata. This protects against the "my karyotypes might be PHI-adjacent" concern from labs.

### Cloudflare service map

| Need | Service |
|---|---|
| Static site + SSR | Pages + Workers |
| User accounts, sessions | D1 (SQLite at edge) |
| Batch history, saved snippets | D1 |
| Large batch payloads (>256kb) | R2 object storage |
| Rate limits, feature flags | KV |
| Stripe webhooks | Worker route |
| Scheduled cleanup (30-day batch retention) | Cron Trigger Worker |
| Error tracking | Sentry (client + server) |
| Structured logs | Axiom |
| Analytics | Plausible or Cloudflare Web Analytics |

### Auth

**Lucia v3** with email magic-link login via Resend or Postmark. No passwords in v1. No SSO in v1.

### Payments

**Stripe Checkout** for initial upgrade, **Stripe Customer Portal** for self-serve management. Webhook handler writes billing state to D1. Handler is idempotent via a `processed_webhook` table keyed on Stripe's `event.id`.

## Engine B — Explain Module (new work)

The Explain module is the primary net-new engineering investment. Everything else (parser, rules, validation UI) largely exists.

### Interface

```typescript
explain(astNode: KaryotypeNode): ExplainResult;

interface ExplainResult {
  summary:    string;              // one sentence, used in hover tooltip
  detail:     string;              // 1-3 paragraphs, used in side panel
  citation:   { section: string; page?: number };
  refs:       { omim?: string[]; hpo?: string[]; clinvar?: string[] };
  confidence: "template" | "curated" | "none";
}
```

### Content strategy (hybrid, priority order)

1. **Template layer (100% coverage, deterministic).** For every parseable AST node, generate a mechanical description from the AST. Example: `del(5)(q13q33)` → "Interstitial deletion on chromosome 5, long arm, from band q13 to q33." No clinical interpretation, no citation-hallucination risk. This powers the default hover tooltip.

2. **Curated content library (static JSON).** Hand-curated file at `packages/core/data/explains/curated.json`, keyed by canonical AST signature, seeded with ~30 entries at launch and grown to ~100–300 post-launch based on usage data. Each entry has a written explanation, ISCN spec citation, and curated OMIM/HPO refs.

3. **No LLM at runtime.** Explain is pure functions + static data. This prevents citation hallucination (a dealbreaker for a tool that trains residents) and keeps the free tier genuinely free to operate. If LLM-assisted content is ever added, it runs offline during curation with human review, and its output is committed to the curated JSON.

### Licensing & citations

- **ISCN spec text:** cannot legally ship PDF content. Citations reference section numbers only (e.g., "ISCN 2024 § 9.2.3"). Users click through to their own copy.
- **HPO (CC-BY 4.0):** ship relevant slice in-repo, update quarterly.
- **OMIM:** license-restricted for commercial use. Link out to omim.org with the OMIM number; do not ship OMIM text.
- **ClinVar:** public domain, link out.
- **Mitelman:** skip (restrictive terms).

### UI surfaces

- **Editor hover tooltip** — shows `summary` only. (Free)
- **Editor side panel on click** — shows `detail` + citation + ref links. (Free)
- **Batch table "Explain" column** — shows `summary` per row. (Pro)

### Curation priority queue

The app logs anonymized `{ ast_signature_hash, timestamp }` whenever a user hovers a node type without a curated entry. This drives a post-launch curation backlog. Zero PII; the signature is a hash of the structural AST, not the original string.

## V1 Feature Set

### Free tier (no account, no signup)

- Single-karyotype editor (paste or type; instant validation, debounced 150ms)
- Inline errors with positions
- Explain hover on recognized tokens (template + curated)
- Explain side panel on click
- Copy-as-JSON (AST export, one button)
- Link to OSS library on GitHub / PyPI / npm

**Not in Free:** history, batch, saved snippets, CSV export.

### Pro tier — $29/mo

Everything in Free, plus:

- **Batch view** — CSV paste or file drop, up to **500 rows** per batch (hard cap). Client-side validation; errors inline in table.
- **Export** — CSV (original + valid/invalid + error column) and JSON (array of ASTs), downloaded client-side.
- **History** — last 30 days of batches, D1-backed, one-click re-open.
- **Saved snippets** — up to 100 named karyotypes per account.
- **Email magic-link login.**

**Not in Pro (deferred to v2):** report authoring, two-person review, audit log, SSO, team workspaces, batches >500 rows, canonical normalization, diff view.

### Pricing mechanics

- $29/mo, monthly only. No annual discount in v1 (simplifies Stripe config).
- **14-day free trial, no credit card required** to start. Card collected at upgrade.
- Self-serve cancel via Stripe Customer Portal.
- Single-user accounts only. Teams/seats come in v2.

### Rate limits

- **Free:** no server rate limit (validation is client-side).
- **Pro:** 500 rows/batch hard cap, 50 batches/day soft cap, 100 snippets lifetime.

## Data Model (D1)

Only Pro persists. Free is stateless.

```sql
-- Auth (Lucia v3 conventions)
CREATE TABLE user (
  id          TEXT PRIMARY KEY,               -- ulid
  email       TEXT UNIQUE NOT NULL,
  created_at  INTEGER NOT NULL,               -- unix seconds
  stripe_customer_id TEXT UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'free',   -- free | pro_trial | pro | canceled
  plan_expires_at INTEGER                     -- unix seconds; null if free
);

CREATE TABLE session (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);

CREATE TABLE magic_link (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  INTEGER NOT NULL,
  consumed_at INTEGER
);

-- Product data
CREATE TABLE batch (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name        TEXT,
  row_count   INTEGER NOT NULL,
  valid_count INTEGER NOT NULL,
  error_count INTEGER NOT NULL,
  csv_r2_key  TEXT,                           -- R2 key if >256kb, else null
  csv_inline  TEXT,                           -- raw CSV if <=256kb
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL                -- created_at + 30 days
);
CREATE INDEX idx_batch_user_created ON batch(user_id, created_at DESC);
CREATE INDEX idx_batch_expires ON batch(expires_at);

CREATE TABLE snippet (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  karyotype   TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  UNIQUE(user_id, name)
);
CREATE INDEX idx_snippet_user ON snippet(user_id);

-- Stripe webhook idempotency
CREATE TABLE processed_webhook (
  event_id    TEXT PRIMARY KEY,
  processed_at INTEGER NOT NULL
);
```

### Storage policies

- **Batch payloads inline up to 256kb, R2 beyond.** Keeps common-case D1 queries fast without bloating the database for rare bulky uploads.
- **30-day retention on batches.** Stated plainly on the pricing page. A nightly Cron Trigger Worker deletes expired rows and their R2 objects. Reduces data-liability surface.
- **Saved snippets never expire.**
- **Only raw CSV is stored, not validation results.** Results re-compute client-side in <1s for 500 rows on replay. Saves ~3× storage; library updates improve historical views for free.
- **PII minimization:** email only. No names, no lab affiliation, no phone.
- **Karyotype strings on their own are not PHI.** ToS explicitly prohibits uploading identified patient data.

### Stripe ↔ D1 sync

Stripe is the billing source of truth. Webhook handlers for:

- `checkout.session.completed` → set `plan = pro`, write `plan_expires_at`
- `customer.subscription.updated` → update `plan_expires_at`
- `customer.subscription.deleted` → set `plan = canceled`
- `invoice.payment_failed` → no state change, alert only

On app load, if `plan_expires_at < now()`, treat as free — don't trust cached `plan` alone.

## Testing Strategy

### Library-level

- **Shared fixture corpus** at `fixtures/karyotypes.json`. Both Python and TypeScript runners consume the same file. Any rule change updates fixtures; CI runs both runners. Catches drift between implementations (currently a real risk per CLAUDE.md).
- **Explain module** — snapshot tests for every AST node type → expected summary template. Curated JSON validated against a JSON Schema in CI (required fields, citation format, at most one OMIM per entry).

### App-level

- **Playwright** for three critical flows:
  1. Paste string → see error → see Explain
  2. Sign up → upgrade → paste batch → export
  3. Cancel subscription → lose Pro features
- **No UI unit tests** in v1. Too brittle, low value for a single-developer project.
- **Stripe test mode** + local webhook CLI. One Playwright test exercises the full trial-signup flow.

## Error Handling

- **Parse errors are not exceptions.** The parser returns a partial `KaryotypeAST` with an `errors[]` array. Editor stays responsive mid-typing. This discipline already exists in the library and is preserved.
- **Worker errors** — top-level try/catch per route, structured log to Axiom, typed JSON error response `{ code, message }`. No stack traces to clients.
- **Client errors** — global error boundary, "reload" fallback, Sentry capture.
- **Stripe webhooks** — idempotent via `processed_webhook` table. Return 500 on processing failure so Stripe retries. Never silently swallow.

## Observability

| Concern | Tool | Notes |
|---|---|---|
| Request volume / errors per route | Cloudflare Workers Analytics | Built-in, free |
| Structured logs | Axiom | Free <500MB/mo |
| Error tracking (client + server) | Sentry | Free tier sufficient |
| Web analytics | Plausible or Cloudflare Web Analytics | Privacy-respecting, no GA |
| Explain curation priority | Custom D1 table + internal Worker route | Anonymized AST signature hashes |

**Explicitly not built in v1:** distributed tracing, metrics dashboards, external uptime monitoring, on-call paging. No SLA, single developer.

## Shipping Sequence

### Milestone 0 — Library consolidation
- Extract `deno/lib/` into `packages/core/`, npm-ready
- Port `tests/test_main.py` fixtures to shared `fixtures/karyotypes.json`
- CI runs both Python and TypeScript against the shared fixture corpus
- Publish `@iscn/core@0.1.0` to npm, `iscn-authenticator@0.2.0` to PyPI

**Gate:** both packages install and validate the shared corpus identically.

### Milestone 1 — Free tier, public
- Scaffold SvelteKit app on Cloudflare Pages
- Single-karyotype editor with client-side validation via `@iscn/core`
- Explain module: template layer + ~30 seeded curated entries
- Hover tooltip + side panel
- Static homepage, pricing page ("Pro coming soon"), OSS link
- SEO-indexable `/explain/<signature>` pages
- Plausible analytics, Sentry

**Gate:** deployed at `iscn.bioinformat.com`, publicly accessible, no signup required.

Free tier sits alone for at least a week. No Pro work begins until Free is observably in use and Explain-miss data indicates which curated entries to prioritize.

### Milestone 2 — Pro tier
- Lucia auth + magic-link email (Resend or Postmark)
- D1 schema migrations
- Stripe Checkout + Customer Portal + webhook handler
- Batch editor (500-row cap)
- CSV/JSON export
- History with R2 offload and 30-day Cron cleanup
- Saved snippets CRUD
- 14-day trial flow
- Playwright tests for the three critical flows

**Gate:** full round-trip — sign up, pay $29, batch 500 rows, export, cancel, lose access.

### Milestone 3 — Post-launch curation
- Internal dashboard showing top-unmatched AST signatures
- Curate 5–10 entries per week against that queue
- Curated JSON version-controlled in-repo; PRs trigger rebuild + deploy

## Go-to-Market

- **Positioning line:** "Validate ISCN karyotypes. Free for clinicians and researchers. Batch, history, and export for $29/mo."
- **Avoid vocabulary:** "diagnostic", "clinical decision support", "FDA", "IVDR". Anything that paints a regulatory target.
- **ToS / privacy copy:** plain English. "We don't want PHI. Don't upload identified karyotypes. 30-day retention on batches. Cancel anytime."
- **Launch channels (priority order):**
  1. `r/cytogenetics`, `r/bioinformatics`, Biostars
  2. Direct message to existing lab + researcher contacts
  3. Show HN post, once Free has been stable for a week
  4. LinkedIn post (cytogenetics has active LinkedIn presence)
- **SEO foundation:** every curated Explain entry is an indexable page. ~30 landing pages at launch, growing weekly.
- **No paid acquisition in v1.**

### Success criteria (90 days post-launch)

- 100+ unique Free users in first 30 days
- 5+ Pro conversions in first 90 days (~$150 MRR)
- Zero PHI incidents
- Explain-miss queue growing faster than curation throughput

### Failure-mode diagnostics

| Symptom | Diagnosis | Response |
|---|---|---|
| Nobody clicks the pricing page | Free tier isn't useful enough | Fix Free; don't build Pro |
| Pricing page visits but no trial starts | Copy/feature list doesn't sell | Fix copy before features |
| Trial but no conversion | Pro features don't justify $29 | Revisit Pro scope; lean-wedge approach may have been wrong choice |

## Out of Scope for v1

Explicitly deferred to v2 or later:

- Team tier (report authoring, two-person review, audit log, SSO, workspaces, roles)
- Research tier (large-batch >500 rows, canonical normalization, diff view, institutional license)
- Enterprise tier (self-host Docker appliance, BAA, air-gap mode, custom rules)
- Developer API + SDKs (skipped per workflow selection)
- Annual billing / seat pricing
- Native mobile or desktop apps (PWA is sufficient)
- LLM-assisted runtime explanations
- Mitelman / COSMIC integration
- Clinical decision support features of any kind

## Open Questions (to resolve during planning)

1. SvelteKit vs. Hono + HTMX for the app framework — SvelteKit is the default recommendation; planning phase confirms.
2. Email provider: Resend vs. Postmark — both work with Workers; pick during implementation.
3. Exact seed list for the ~30 launch-day curated Explain entries — compile from ISCN 2024 TOC + common clinical cases.
4. Whether to rename the PyPI package to match the npm package (e.g., `iscn-core` on PyPI) or keep the current `iscn-authenticator` name — affects discoverability vs. existing installs.

## References

- Existing validation engine design: `docs/plans/2025-12-16-validation-engine-design.md`
- Existing validation engine implementation: `docs/plans/2025-12-16-validation-engine-implementation.md`
- Project overview and parser gotchas: `CLAUDE.md`
- ISCN 2024 specification (not checked in): `Iscn 2024 An International System for Human Cytogenomic Nomenclature.pdf`
