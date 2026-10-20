# Release and deployment

This repository ships the TypeScript core, Deno runtime, Python HTTP wrapper,
and Cloudflare Pages application. The Python library is released from
[iscn-authenticator-py](https://github.com/nuin/iscn-authenticator-py).
There are no client-package or Python-library publishing workflows here.

## Available workflows

| Workflow | Trigger | Result |
|---|---|---|
| [ci.yml](../.github/workflows/ci.yml) | Configured pull requests and branch pushes | Core, API wrapper, Deno, and web checks |
| [publish-npm.yml](../.github/workflows/publish-npm.yml) | `v*-core` tag | Build and publish `@iscn/core` |
| [publish-web.yml](../.github/workflows/publish-web.yml) | `v*-web` tag or manual dispatch | Build and deploy Pages project `iscn-web` |

Read the actual workflow before a release. The npm workflow checks the tag
against `packages/core/package.json`; the web workflow uses its configured
trigger and deployment command. Do not assume a tag verifies product readiness.

## Verify a release candidate

Use Node.js 24 LTS, Deno 2.9.7, and Python 3.11 or newer. Run from the repository
root unless a command changes directory:

```bash
npm --prefix packages/core ci
npm --prefix packages/core test
npm --prefix packages/core run build
npm --prefix packages/core run check:browser
uv sync --project api --locked
uv run --project api --locked --python 3.11 python -m unittest discover -s api/tests -v
```

Run `deno task check` and `deno task test` from `deno/`, then check the web app:

```bash
cd packages/web
npm ci
npm run types:cloudflare -- --check
npm run check
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

Run `aislop scan -d .` and `git diff --check` from the repository root. Resolve
blocking findings without weakening the rules. Retain the actual command results
for the release candidate; a prior green branch does not verify a new commit.

After a core change, run `npm run build:browser` from `packages/core` and include
the embedded update to `deno/main.ts`. After a Cloudflare binding change,
regenerate and include `packages/web/src/worker-configuration.d.ts`. Schema changes
require an explicit migration and rollback assessment.

If the OpenAPI contract changes, regenerate its embedded copy with
`deno run --allow-read --allow-write deno/scripts/embed-openapi.ts` from the root.
The Deno suite checks the two copies byte-for-byte.

Review the [launch-readiness checklist](launch-readiness.md), including coverage
notices, local browser processing, key visibility, mobile navigation, batch
exports, report/FISH records, CNV evidence boundaries and billing availability.
Use the synthetic cases in [laboratory review](laboratory-review.md) and
[CNV evidence](cnv-evidence.md), including edits after calculation and exact score
and cutoff boundaries. Tests are evidence for exercised behavior,
not proof of complete ISCN coverage or clinical performance.

## Publish the core

Update the package version and release notes, review the commit, and tag that
specific commit using `v<version>-core`. Push only the intended release tag.
The npm workflow requires `NPM_TOKEN` with publishing access to the package.

The workflow builds the package, checks the tag, runs its configured smoke check,
and publishes with provenance. Verify the registry version and test the exact
released version in an isolated environment afterward. Do not use `@latest` as a
substitute for identifying the release that was tested.

When shared validation semantics change, coordinate the Python implementation and
shared corpus, release that corpus, and advance the fixture pin in
`packages/core/package.json`. Python library publication belongs in its own repository.

The laboratory-review validation update uses Python commit
`47e1c8124364952e0afeff71128d43e526716354` and the shared corpus tag
`fixtures-lab-review-20261019`. The API wrapper pins that Git revision through
`tool.uv.sources` and `api/uv.lock` so it receives the same fixes before a PyPI
release. Use the documented `uv --locked` commands; a plain pip install of the
older PyPI release does not include them. This fixture tag does not publish to PyPI.

## Cloudflare Pages

The existing project is `iscn-web`, with production at
[iscn-web.pages.dev](https://iscn-web.pages.dev). Its D1 binding `DB` points to
`iscn-db`; the database ID is in
[`packages/web/wrangler.toml`](../packages/web/wrangler.toml). The current Pages
application does not use KV or R2.

GitHub deployment requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` with
access to the intended account/project. Verify the target before starting the
workflow. The runtime's D1 data is independent of Deno KV.

### Direct deployment

After building core and passing the web checks, run from `packages/web`:

```bash
npx wrangler pages deploy .svelte-kit/cloudflare --project-name=iscn-web --branch=master
```

`--branch=master` targets the configured production branch. Use an explicit
non-production branch name for a preview. This command publishes externally;
run it only as part of an authorized release.

Use the project-local Wrangler version and check `wrangler pages deploy --help`
before changing flags. Cloudflare's [direct-upload instructions](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
describe the upload flow and the required Cloudflare Pages Edit permission.

Record the commit, deployment ID, URL, environment, and verification results.
Check the production homepage, validator, laboratory workspace with its side
documentation, guide pages, login, and configured
billing state after deployment. Do not expose keys or account records in the
release report.

### Bootstrap a new environment only

Existing production does not need to be recreated. For a separate environment,
create its own Pages project and D1 database, update the binding, initialize a new
database from `schema.sql`, and generate binding types. Use migrations for an
existing database rather than replaying initialization blindly.

The Pages Stripe flow uses these server-side secrets:

```bash
npx wrangler pages secret put STRIPE_SECRET_KEY --project-name=iscn-web
npx wrangler pages secret put STRIPE_PRICE_ID_PRO --project-name=iscn-web
npx wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name=iscn-web
npx wrangler pages secret put PUBLIC_BASE_URL --project-name=iscn-web
```

The command targets shown above are the existing project; substitute the intended
new project for a separate environment. Configure billing only after the owner
has selected the account, price, and commercial terms. The webhook path is
`/api/webhooks/stripe`, not the Deno `/billing/webhook` route. Absent Stripe
configuration should leave paid checkout unavailable.

## Recovery

Keep the previous verified deployment identifiable. Use Pages rollback controls
for a failed web deployment and verify critical routes afterward. Code rollback
does not roll back D1 data; check migration compatibility before reverting.

Keep deployment credentials, billing configuration, and account records outside
public release notes. Publish only supported feature claims and current coverage
limits. Archived plans and legal templates are not release acceptance evidence.
