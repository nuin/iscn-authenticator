# Release process

Packages are published from tagged commits by GitHub Actions. There are four
tag conventions, one per publishable artefact:

| Tag pattern      | Package              | Registry          | Workflow                                   |
| ---------------- | -------------------- | ----------------- | ------------------------------------------ |
| `v*-core`        | `@iscn/core`         | npm               | `.github/workflows/publish-npm.yml`        |
| `v*-client`      | `@iscn/client`       | npm               | `.github/workflows/publish-npm-client.yml` (M3a/8) |
| `v*-py`          | `iscn-authenticator` | PyPI              | `.github/workflows/publish-pypi.yml`       |
| `v*-py-client`   | `iscn-client`        | PyPI              | `.github/workflows/publish-pypi-client.yml` (M3a/7) |
| `v*-web`         | `iscn-web`           | Cloudflare Pages  | `.github/workflows/publish-web.yml`        |

The version embedded in the tag must match the version recorded in the
package's manifest (`packages/core/package.json`, `pyproject.toml`, etc.).
Each workflow runs a `verify-tag` step before building so that mismatched
tags fail loudly.

## Required secrets

Configure these as repository secrets in GitHub:

| Secret                  | Used by                                             |
| ----------------------- | --------------------------------------------------- |
| `NPM_TOKEN`             | `publish-npm.yml`, `publish-npm-client.yml`         |
| `PYPI_TOKEN`            | `publish-pypi.yml`, `publish-pypi-client.yml`       |
| `CLOUDFLARE_API_TOKEN`  | `publish-web.yml`                                   |
| `CLOUDFLARE_ACCOUNT_ID` | `publish-web.yml`                                   |

`NPM_TOKEN` must be an automation token with publish rights on the `@iscn`
scope. `PYPI_TOKEN` must be a project-scoped token (one per package is
recommended). `CLOUDFLARE_API_TOKEN` needs the **Pages: Edit** permission
on the target account.

## Checklist before tagging

1. Working tree is clean and on `master`.
2. `CHANGELOG.md` has an entry for the new version.
3. `package.json` / `pyproject.toml` version bumped.
4. CI on `master` is green.

## Publishing `@iscn/core`

```bash
# from repo root
cd packages/core
# bump version in package.json, commit
git commit -am "chore(core): v0.1.1"
git tag v0.1.1-core
git push origin master --tags
```

The `publish-npm.yml` workflow will:

1. Check out the tagged commit.
2. Run `scripts/verify-tag.mjs` (asserts tag == `package.json` version).
3. `npm ci --ignore-scripts`.
4. `npm run build`.
5. Smoke-test the built bundle against `46,XX`.
6. `npm publish --access public --provenance`.

## Publishing `iscn-authenticator`

```bash
# bump version in pyproject.toml + CHANGELOG.md, commit
git commit -am "chore(py): v0.2.1"
git tag v0.2.1-py
git push origin master --tags
```

The `publish-pypi.yml` workflow will:

1. Check out the tagged commit.
2. Run `scripts/verify-pypi-tag.py` (asserts tag == `pyproject.toml` version,
   rejects `v*-py-client` tags so the wrong workflow can never fire).
3. `pip install build twine`.
4. `python3 -m build` (sdist + wheel via hatchling).
5. `twine check dist/*`.
6. Smoke-test the wheel: `pip install dist/*.whl` in a fresh venv and import.
7. `twine upload --non-interactive dist/*` using `PYPI_TOKEN`.

## Post-release verification

```bash
# npm
npm view @iscn/core version
npm install @iscn/core@latest --prefix /tmp/verify
node --input-type=module \
  -e "import('@iscn/core').then(m => console.log(m.isValidKaryotypeNative('46,XX')))"

# PyPI
pip index versions iscn-authenticator
python3 -m venv /tmp/verify-py && /tmp/verify-py/bin/pip install -U iscn-authenticator
/tmp/verify-py/bin/python -c "from iscn_authenticator import is_valid_karyotype; print(is_valid_karyotype('46,XX'))"
```

Additional sections for the two client packages will be added as their
workflows land (M3a/7, M3a/8).

## Publishing `iscn-web` (Cloudflare Pages)

```bash
git tag v0.1.0-web
git push origin master --tags
```

The `publish-web.yml` workflow will:

1. Check out the tagged commit.
2. Install + build `@iscn/core` (the web app imports it via `file:../core`).
3. `npm ci --ignore-scripts` + `npm run check` + `npm run build` in `packages/web`.
4. `wrangler pages deploy .svelte-kit/cloudflare --project-name=iscn-web`.

### One-time bootstrap

Before the first deploy you need a Cloudflare account with a Pages project
and the bound resources:

```bash
# create the project (production branch is master)
wrangler pages project create iscn-web --production-branch=master

# D1 database for users/keys/webhooks; paste the returned id into wrangler.toml
wrangler d1 create iscn-db
wrangler d1 execute iscn-db --file=packages/web/schema.sql

# KV namespace + R2 bucket; paste ids into wrangler.toml
wrangler kv:namespace create KV
wrangler r2 bucket create iscn-batches

# Secrets (set once per environment in the Pages project)
wrangler pages secret put STRIPE_SECRET_KEY      --project-name iscn-web
wrangler pages secret put STRIPE_WEBHOOK_SECRET  --project-name iscn-web
wrangler pages secret put STRIPE_PRICE_ID_PRO    --project-name iscn-web
wrangler pages secret put PUBLIC_BASE_URL        --project-name iscn-web
# optional log sink
wrangler pages secret put AXIOM_API_TOKEN        --project-name iscn-web
wrangler pages secret put AXIOM_DATASET          --project-name iscn-web
```

After the first deploy, point the Stripe webhook at
`${PUBLIC_BASE_URL}/api/webhooks/stripe` and copy the resulting
`whsec_…` value into `STRIPE_WEBHOOK_SECRET`.
