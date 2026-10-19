# ISCN Authenticator: interface and documentation for laboratories

## Intent and authorization

The user wants a complete interface and documentation overhaul for commercialization.
The first customers are labs. They explicitly chose: “Choose the design and build
the overhaul.” Design and implementation choices below are the builder's decisions.

The product should help a lab scientist review karyotype notation and help a lab
informatics engineer evaluate integration. Preserve the existing SvelteKit 3,
Cloudflare Pages/D1 deployment and source-consumed TypeScript core.

## Product boundaries

The deployed Pages product has browser validation, example explanations, account
creation, key login/management, and browser batch validation. It does not expose
the Deno service's `/validate`, `/usage`, or quota system. Pages and Deno keys are
stored separately. Paid checkout is not configured in production. Do not present
the existing zero-valued usage placeholder as telemetry.

Core validation is a set of implemented checks, not complete ISCN certification.
Unknown abnormalities can pass through; extended assay notation is preserved as
text; mosaic rule evaluation uses the first cell line. Surface these limitations
where results are used. Do not change the core validation contract or scientific
semantics during this interface project.

## Design

Use a precise, spacious scientific application with a chromosome-band motif as
its recognizable element. No stock laboratory photography, fabricated customer
logos, efficacy statistics, certifications, or testimonials.

- Paper `#F6F9FC`, white `#FFFFFF`, ink `#142B3F`, Atlantic `#005B73`, pale cyan
  `#D9F1F5`, error `#B84242`; amber and green are reserved for result states.
- Public Sans for navigation/body/display; IBM Plex Mono for karyotypes/code.
  Self-host licensed font files, with system fallbacks.
- Left-aligned headings, generous whitespace, restrained panels and clear tables.
  One public navigation system, a focused application sidebar, and a documentation
  sidebar. Mobile navigation remains available at every width.
- Visible focus, semantic headings, explicit form labels, accessible status text,
  reduced motion, readable long code, and no page-level horizontal overflow at 375px.

The public homepage pairs the value proposition with a chromosome illustration
and a real, clearly labeled example. The primary action opens the validator;
secondary actions lead to coverage and integration documentation.

## Routes and behavior

- `/`: lab-facing product homepage, real workflow overview and feature availability.
- `/validate`: dedicated browser workspace; examples, helpful empty/error states,
  parsed results, chromosome overview, copy/export and coverage notes. Existing
  `/?karyotype=` links continue to work through a redirect to the workspace.
- `/explain` and `/explain/[signature]`: searchable example library with source
  labels, no expanded clinical claims, working links to validate applicable examples.
- `/docs`: documentation home; `/docs/[slug]`: task-based guides with search,
  readable code examples and contextual navigation.
- `/signup`, `/login`: consistent onboarding; preserve one-time key reveal before
  navigation, clear key-copy feedback, and secure existing session behavior.
- `/dashboard`: real account/key information and workflow shortcuts, no invented
  usage or activity. `/dashboard/keys`: existing create/revoke flows, clear states.
- `/dashboard/batch`: one karyotype per line, at most 500; row-level issues and
  coverage notes, CSV/JSON downloads, no silent row loss. Existing signed-in access
  is made discoverable rather than claiming it is an enforced Pro entitlement.
- `/dashboard/billing` and `/pricing`: describe available access honestly. Show a
  clear unavailable state when checkout secrets are absent; preserve configured
  Stripe actions. Do not claim API quotas, history or team permissions that do not
  exist in Pages. Do not invent a commercial price, support SLA, or contact address.
- `/about`, `/privacy`, `/terms`: same visual system, readable information hierarchy.
  Privacy copy follows actual data flows; business/legal commitments are not invented.

Validation in the browser must not automatically transmit the entered karyotype
or its normalized signature. Remove automatic explanation-miss reporting from the
interactive validator. Account and billing requests remain server requests.
Exports are explicit downloads, never persisted to a backend. Warn on incomplete
coverage without changing `ValidationResult.valid`; raw JSON remains the core result.

## Documentation

Create guides for getting started, reading results, coverage/limitations, batch
review, accounts and keys, integration, and data handling. Explain hosted browser
workflows separately from the optional self-hosted Deno API and Python wrapper.
Use executable examples and real response shapes, including nullable fields.

Rewrite README as the repository/product entry point; reconcile quickstart, API,
billing, operator and release documentation. Preserve detailed Deno operator
reference, clearly scoped. Compliance templates remain templates, not evidence
of certification. A launch-readiness document records decisions still needed:
commercial packaging/price, configured checkout, support contact/legal entity,
reviewed terms, and a production hosted API if that is to be sold.

## Acceptance

Core behavior and existing account/key/Stripe action tests remain valid. Browser
tests cover desktop and mobile navigation, valid/invalid/incomplete-coverage results,
no validation network payload, batch limits and downloads, doc navigation/search,
and one-time signup key visibility. Verify exports with quotes, newlines and
spreadsheet formula prefixes. Inspect desktop/mobile screenshots and keyboard flow.
Build, typecheck and aislop must pass. Do not modify aislop rules or the unrelated
`.cairn` file. Do not add dependencies beyond fonts unless necessary and justified.

## Delivery

Implement and verify the overhaul in this working branch. Commit and push reviewed
work following the user's existing workflow; deploy the finished, verified update
to the existing Cloudflare Pages project under the user's continuing deployment
instruction. No new billing secrets, paid purchases, or custom domains are inferred.
