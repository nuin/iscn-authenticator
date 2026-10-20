# ISCN Authenticator

A workspace and software library for reviewing ISCN karyotype notation. Laboratory
scientists can check single entries or batches in the browser; informatics teams
can evaluate the TypeScript core or run a separate HTTP service.

The laboratory review workspace reconciles notation, metaphase totals and a
structured report conclusion, compares prior findings, and exports a reviewer
record. It also includes a bounded FISH constructor and a constitutional CNV
evidence worksheet with explicit scoring coverage.

[Open the workspace](https://iscn-web.pages.dev/validate) ·
[Read the guides](https://iscn-web.pages.dev/docs) ·
[Review coverage](https://iscn-web.pages.dev/docs/coverage)

## What a result means

The validator parses notation and runs implemented chromosome and abnormality
rules. `valid: true` means those rules found no errors. It does **not** establish
complete ISCN 2024 conformity, clinical significance, or approval to release a report.

Known limits affect otherwise passing results:

- Unrecognized abnormalities can be retained as `type: "unknown"` and pass.
- Every cell line receives the implemented rules. Ordering multiple abnormal
  clones and confirming donor identity still require context and manual review.
- Accepted `nuc ish`, `arr`, and `ogm` modifiers are retained as text without full
  assay-specific validation.
- Chromosome count ranges receive ascending positive-integer checks; their
  chromosome composition and numerical coherence still require review.
- Structural chromosome names and supported cytobands are checked against the
  bundled catalogue. Finer subbands and complex nested rearrangements need review.

Use representative examples and known errors when evaluating the tool for a lab
workflow. Keep manual review for unsupported notation.

## Choose a workflow

| Workflow | Where checks run | Access |
|---|---|---|
| [Single entry](https://iscn-web.pages.dev/validate) | Browser | No account needed |
| [Report QC, FISH and CNV evidence](https://iscn-web.pages.dev/review) | Browser; explicit local exports | No account needed |
| [Batch review](https://iscn-web.pages.dev/dashboard/batch) | Browser, up to 500 entries | Sign in |
| TypeScript core | Your Node or Deno process | Consume from source |
| Deno HTTP API | A deployment you operate | Keys issued by that Deno deployment |
| Python HTTP wrapper | A deployment you operate | No built-in API-key authentication |

The hosted Cloudflare Pages application does not expose `/api/validate`. Its
`/validate` route is an interactive page, not the Deno API. Hosted account keys
live in D1 and are separate from Deno KV keys. Browser checks do not upload entered
notation; account and billing actions contact the server. Downloads are local,
and no server-side validation history is provided.

Paid checkout is unavailable when Stripe is unconfigured. Deno quotas are
self-hosted service defaults, not hosted browser plan allowances. See
[commercial availability](docs/billing.md) and [launch readiness](docs/launch-readiness.md).

## Documentation

- [Quickstart](docs/quickstart.md): browser review and a local core example.
- [Laboratory review](docs/laboratory-review.md): report checks, FISH construction, record schemas and developer architecture.
- [Notation coverage](docs/notation-coverage.md): implemented grammar, rule boundaries and exclusions.
- [CNV evidence](docs/cnv-evidence.md): supported ACMG/ClinGen categories, provisional scoring and evidence requirements.
- [Reference register](docs/reference-register.md): editions, errata and what each source supports.
- [API reference](docs/api.md): self-hosted Deno endpoints and the separate Python wrapper.
- [Operator guide](docs/admin.md): Deno configuration, keys, logs, and incidents.
- [Billing](docs/billing.md): current hosted access and runtime-specific Stripe setup.
- [Release process](docs/release.md): checks, publishing, and Pages deployment.
- [Compliance templates](docs/compliance/README.md): unreviewed drafting aids, not certifications.

## Repository layout

| Component | Location | Purpose |
|---|---|---|
| TypeScript core | [`packages/core/`](packages/core/) | Parser, rules, explanation helpers, and types; Node and Deno |
| Hosted web app | [`packages/web/`](packages/web/) | SvelteKit application on Cloudflare Pages with D1 accounts |
| Deno service | [`deno/`](deno/) | Optional HTTP API, middleware, admin CLI, and lightweight UI |
| Python wrapper | [`api/`](api/) | FastAPI wrapper around the external Python package |
| Python reference library | [Separate repository](https://github.com/nuin/iscn-authenticator-py) | Python implementation and shared fixture corpus |

The TypeScript fixture suite downloads the corpus from the Python release pinned
in [`packages/core/package.json`](packages/core/package.json). Agreement with that
corpus is a regression check, not proof of complete nomenclature coverage.

## Run the TypeScript core

Use Node.js 24 LTS; `.nvmrc` records the development version. From the repository root:

```bash
npm --prefix packages/core ci
npm --prefix packages/core run build
node --input-type=module -e '
  import { validateKaryotypeNative } from "./packages/core/dist/index.js";
  console.log(JSON.stringify(validateKaryotypeNative("46,XX"), null, 2));
'
```

The result is `{ valid, errors, parsed }`. For this example, `parsed.cell_lines`
and `parsed.modifiers` are `null`. See [result fields](docs/api.md#result-contract).

Deno can import `./packages/core/src/index.ts` directly. The repository enables
`unstable: ["sloppy-imports"]` so internal `.js` specifiers resolve to TypeScript.
Use Deno 2.9.7 to match CI.

## Development and checks

```bash
# Core: pinned fixtures, Deno tests, Node tests
npm --prefix packages/core test
npm --prefix packages/core run check:browser

# Web: build core first as shown above
npm --prefix packages/web ci
npm --prefix packages/web run types:cloudflare -- --check
npm --prefix packages/web run check
npm --prefix packages/web run build
npm --prefix packages/web test
cd packages/web
npx playwright install chromium
npm run test:browser
```

After a core change, regenerate the browser assets with
`npm --prefix packages/core run build:browser` and commit the embedded bundle in
`deno/main.ts`. The local `deno/static/iscn-core.js` output is ignored.
After a Cloudflare binding change, run `npm run types:cloudflare` inside
`packages/web` and commit `src/worker-configuration.d.ts`.

For the Python wrapper, from the repository root:

```bash
uv sync --project api --locked
uv run --project api --locked python -m uvicorn api.server:app --reload
uv run --project api --locked --python 3.11 python -m unittest discover -s api/tests -v
```

Python 3.11 or newer is required. Dependency edits belong in `api/pyproject.toml`;
regenerate `api/uv.lock` with `uv lock --project api`. Python library development
and tests belong in the separate Python repository.

For the Deno service, run `deno task dev`, `deno task check`, and `deno task test`
from `deno/`. Read the [operator guide](docs/admin.md) before exposing a deployment.

See [AGENTS.md](AGENTS.md) for architecture and contribution guidance. Archived
plans in `docs/archive/` describe historical work, not current product promises.

## License

MIT for the software. The ISCN reference publication is separate copyrighted
material; a software license does not grant rights to redistribute that publication.
