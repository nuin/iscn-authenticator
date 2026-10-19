# Laboratory Interface Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; independent file scopes
> are delegated according to superpowers:dispatching-parallel-agents.

**Goal:** Deliver a complete lab-facing interface and accurate commercialization documentation.

**Architecture:** Preserve the core and Cloudflare runtime. Add a shared visual
system, dedicated browser tools, factual account screens and task-based docs.
Parallel workers own disjoint route groups; the primary agent integrates and reviews.

**Tech Stack:** SvelteKit 3, Svelte 5, TypeScript 6, Node 24, Cloudflare Pages/D1, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-19-lab-commercial-interface.md`

## Global constraints

- No validation semantics changes, fictional capability claims, or new paid resources.
- Keep input local in browser tools. Preserve secure sessions and one-time key reveal.
- Use the spec palette, shared CSS variables/classes, and existing #lib imports.
- Each component/module should remain below 400 lines. No disabled quality rules.
- Do not edit `.cairn`; do not merge this branch into master.

## Review focus

- Unsupported and mosaic inputs must not be presented as fully validated.
- A newly created account must retain its one-time key until the user continues.
- Signed-out users must reach login from protected tools; mobile navigation must work.
- Batch exports must preserve every input row and escape spreadsheet-sensitive values.
- Pricing/docs must reflect absent checkout and the separation of Pages/Deno credentials.

## Tasks

### 1. Shared visual system and public site — primary agent

Files: `src/app.css`, `src/routes/+layout.svelte`, `+layout.server.ts`,
`+page.svelte`, `+page.server.ts`, `src/lib/components/Brand.svelte`, and
public about/library/privacy/terms routes under `packages/web`.

- [x] Establish tokens and reusable `.page-shell`, `.button`, `.panel`, `.notice`,
  `.page-heading`, `.muted`, `.mono` styles; self-host fonts.
- [x] Build responsive navigation, footer, homepage and public route redesigns.
- [x] Keep old example links working and add page titles/descriptions.
- [x] Inspect desktop/mobile screenshots and keyboard navigation.

### 2. Validation and batch workspaces — validation worker

Files: `src/routes/validate/+page.svelte`, `src/routes/dashboard/batch/+page.svelte`,
`src/lib/validation.ts`, focused validation components, `Ideogram.svelte`,
`tests/validation.test.mjs`.

- [x] Test coverage classification, invalid input, 500/501 lines and safe CSV fields.
- [x] Implement browser-only validation, parsed details, example selection and exports.
- [x] Implement accessible batch review with no silent dropped rows.
- [x] Run focused Node tests; report the component and helper interfaces for integration.

### 3. Accounts and commercial availability — account worker

Files: signup/login routes; dashboard layout, overview, keys and billing routes;
pricing routes; `src/lib/server/availability.ts` if needed.

- [x] Redesign onboarding and key management, retaining existing action contracts.
- [x] Replace fake usage with database-derived account information.
- [x] Show batch navigation to existing signed-in users and useful empty states.
- [x] Expose only boolean checkout availability to clients; hide unavailable actions
  and preserve action-level checks and Stripe redirect behavior.
- [x] Verify signup key remains visible and no secret values enter page data.

### 4. Product and technical documentation — documentation worker

Files: `/docs` routes and `src/lib/docs/` content; README, current docs markdown,
and launch-readiness document. Do not edit archived documents or this plan/spec.

- [x] Build docs index/search and guide pages using the shared styles.
- [x] Reconcile route, credentials, nullable-result and quota examples with source.
- [x] Distinguish current hosted product from self-hosted API and future commercial setup.
- [x] Check documentation links and execute representative examples.

### 5. Integration and verification — primary agent

Files: `tests/pages.test.mjs`, `tests/browser/` and any integration fixes.

- [x] Update public-page assertions and add meaningful browser flow tests.
- [x] Build core as needed, run web check/build, Node integration and Chromium suites.
- [x] Review final code and screenshots, fixing findings before delivery.
- [x] Run `aislop scan -d .` and `git diff --check`; resolve all new findings.

### 6. Delivery — primary agent

- [ ] Commit and push the complete overhaul, excluding unrelated files/generated artifacts.
- [ ] Deploy to existing `iscn-web` production Pages project.
- [ ] Verify live routes, browser tools, documentation and database authentication checks.
- [ ] Report deployed URL and remaining business decisions without claiming checkout is live.

## Verification record

Implementation verified on 2026-10-19: Svelte check reported zero errors and
warnings; the Cloudflare build passed; all 20 Node tests and five Chromium
workflows passed. Desktop/mobile screenshots, horizontal overflow, keyboard
skip navigation and browser errors were checked. Independent review findings
were corrected and covered by regression tests. `aislop scan -d .` scored
100/100 with zero findings. Delivery tasks follow this implementation commit.
