# Laboratory launch follow-through

> Continue the approved interface design using executing-plans and the
> dispatching-parallel-agents skill for the independent billing scope.

**Goal:** Address concrete launch gaps after the initial interface deployment.
**Architecture:** Keep browser validation local and reuse the existing Pages/D1
account system. Improve billing processing without schema changes or activating
payments. Add a public evaluation guide with synthetic starter files.
**Tech stack:** Existing SvelteKit, TypeScript, Node 24, Cloudflare Pages/D1.
**Spec:** `docs/superpowers/specs/2026-10-19-lab-commercial-interface.md`.

## Constraints and decisions

- The user said “continue”; prior commit, push and deployment authorization remains.
- Preserve core validation semantics, result contracts and existing runtime boundaries.
- No invented seller identity, support contact, price, certification or paid entitlement.
- The owner supplied Bioinformat as the seller/business name. Publish that name;
  support contact, subscription price and legal entity details remain open.
- Do not change schema, production secrets, quality rules or unrelated `.cairn`.
- A local simulated billing test is not evidence of a live Stripe purchase.

## Tasks and acceptance

- [x] Billing worker: validate signed event shapes, return sanitized retryable
  failures, and commit state changes with duplicate tracking atomically. Only
  reconcile paid eligibility from current subscriptions matching the configured
  price and account ownership. Test unpaid checkout, async success, payment
  recovery, cancellation, duplicates, rollback, invalid input and unknown users
  against transactional SQLite. Document remaining ordering constraints.
- [x] Primary: focus completed single/batch results after an explicit check;
  keep mobile batch issue/coverage text visible without horizontal scrolling.
  Add browser regressions that fail against the original layout.
- [x] Primary: publish `/docs/lab-evaluation` with synthetic inputs and a local
  review worksheet. Distinguish observed implementation behavior from independent
  lab acceptance. Test download contents and expected example classifications.
- [x] Run web type/build/integration/browser checks, independent review,
  `aislop scan -d .`, and `git diff --check`. Inspect desktop/mobile output.

Release handoff: commit and push the verified source, deploy to existing Pages
production, and report the deployment URL and live checks after shipping.

## Review focus

- Unpaid or unrelated subscriptions must not grant a paid account state.
- Retryable failures must not be marked processed; duplicates must be harmless.
- Current Stripe state can change between a read and a database write; describe
  this remaining limitation rather than promising globally ordered processing.
- Result focus must follow user submission and must not reset input or exports.
- Starter examples are implementation checks, not a clinical acceptance corpus.

## Evidence

Pre-release verification on 2026-10-19, Node 24.22:

- `npm run check`: zero errors and warnings; `npm run build`: passed.
- `npm test`: 76 passed, including 53 webhook cases and built Pages/D1 HTTP checks.
- `npm run test:browser`: seven passed against the production build.
- Mobile focus and batch-detail regressions failed against the original build,
  then passed after implementation.
- Desktop/mobile captures inspected: home, validator, evaluation guide, signup,
  account and batch. No document overflow or browser runtime errors; keyboard
  skip navigation passed.
- Fresh independent review found no source regression. Its missing acceptance
  coverage finding was addressed with nonexistent-account and pre-association
  lifecycle/retry tests; both passed with the complete suite.
- `aislop scan -d .`: 100/100, zero findings. `git diff --check`: passed.

The production bundle includes the Bioinformat attribution and the final event
identifier validation. No schema changes or billing secrets were applied. Paid
launch still needs the owner decisions and billing reconciliation/lifecycle work
documented in `docs/launch-readiness.md` and `docs/billing.md`.
