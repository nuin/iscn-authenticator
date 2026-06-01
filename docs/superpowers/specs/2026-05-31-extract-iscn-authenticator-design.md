# Extract `iscn_authenticator` Python library to a standalone repo and publish to PyPI

**Status:** Draft — awaiting user review
**Date:** 2026-05-31
**Owner:** nuin
**Companion artifacts:** `docs/superpowers/plans/2026-05-31-extract-iscn-authenticator.md` (to be produced by `writing-plans` after this spec is approved)

---

## 1. Goals and non-goals

### Goals

1. Move the Python validation library out of this monorepo into a standalone Git repository.
2. Publish version 0.2.0 to PyPI under the name `iscn-authenticator`.
3. Switch the monorepo's remaining Python consumers (`api/server.py`, `scripts/validate_json.py`) to depend on the published package.
4. Establish a fixture-sync protocol so the monorepo's TypeScript port can still execute parity tests against the same `validity.json` corpus after the split.
5. Adopt minimal modernization (ruff, pre-commit) in the new repo while leaving public behavior unchanged.
6. Configure PyPI Trusted Publishing (OIDC) so no long-lived API token is stored in repo secrets.

### Non-goals

- No changes to the public Python API (`validate_karyotype`, `is_valid_karyotype`, etc.).
- No version bump beyond 0.2.0; the move is not a breaking change.
- No changes to the TypeScript port's validation behavior.
- No changes to validation semantics or fixture contents.
- No mypy, no uv, no full tooling overhaul beyond ruff + pre-commit.
- No git history preservation (`git filter-repo` was considered and rejected by the user).
- No mirror of `fixtures/validity.json` on PyPI as a separate package.
- No changes to the Deno app or the SvelteKit web app.
- **No curated explanation lookup in v0.2.0.** During Phase 1, `explain.py` was discovered to read `packages/core/data/explains/curated.json` from a relative path that only resolves inside the monorepo (a hidden runtime dependency on the TypeScript port). The curated lookup (`lookup_curated_explanation`) and its 2.1 KB data file were removed from the v0.2.0 release; `explain()` now always returns a template-based explanation. The curated feature, with proper data-sync mechanism between repos, is deferred to a future minor release. Template explanation via `generate_template_explanation` remains in the public API.

## 2. New repo layout

The new repo is created fresh with `git init`. Chosen on-disk path: `/Users/nuin/Projects/iscn-authenticator-py/`. Chosen GitHub path: `nuin/iscn-authenticator-py` (the monorepo already occupies `nuin/iscn-authenticator`, so the new Python repo takes the `-py` suffix). The PyPI package name remains `iscn-authenticator` — package names and repo names need not match. The existing `Repository` URL in `pyproject.toml` (pointing at `github.com/nuin/iscn-authenticator`, the monorepo) must be updated to `github.com/nuin/iscn-authenticator-py` during the move.

```
iscn-authenticator/                    # new repo, fresh git init
├── iscn_authenticator/                # verbatim copy from monorepo
│   ├── __init__.py
│   ├── main.py
│   ├── parser.py
│   ├── engine.py
│   ├── explain.py
│   ├── models.py
│   └── rules/
│       ├── __init__.py
│       ├── base.py
│       ├── chromosome.py
│       └── abnormality.py
├── tests/                             # verbatim copy from monorepo
│   ├── __init__.py
│   ├── test_main.py
│   ├── test_parser.py
│   ├── test_engine.py
│   ├── test_models.py
│   ├── test_explain.py
│   ├── test_fixtures.py
│   ├── test_rules_base.py
│   ├── test_rules_chromosome.py
│   └── test_rules_abnormality.py
├── fixtures/
│   └── validity.json                  # source of truth lives here from now on
├── pyproject.toml                     # existing one + [tool.ruff] block
├── README.md                          # rewritten for standalone framing (see §10)
├── CHANGELOG.md                       # Python-only entries extracted from monorepo CHANGELOG
├── LICENSE                            # MIT, unchanged
├── .gitignore                         # Python-focused (dist/, *.pyc, __pycache__, .venv, .ruff_cache)
├── .pre-commit-config.yaml            # ruff check + ruff format + whitespace hooks
├── .github/
│   └── workflows/
│       ├── ci.yml                     # NEW: ruff + unittest matrix + `python -m build` + `twine check`
│       └── publish-pypi.yml           # adapted from monorepo, Trusted Publishing variant
└── scripts/
    └── verify-pypi-tag.py             # carried over unchanged
```

Explicitly **not** carried to the new repo:

- `iscn_2024.txt` and the ISCN 2024 PDF (reference material; keep in monorepo).
- `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` (slim, library-focused versions will be written fresh in a follow-up if desired — out of scope for this spec).
- `docs/` (monorepo-wide; library docs are README + docstrings).
- Anything under `api/`, `deno/`, `packages/`, `docs/`.

## 3. Fixture sync mechanism

### Problem

After the split, `fixtures/validity.json` lives in the new Python repo. The monorepo's TypeScript port (`packages/core/tests/fixtures.test.ts`) needs to read the same file to enforce cross-implementation parity.

### Mechanism

A small Node script in the monorepo fetches `fixtures/validity.json` from a pinned tag of the new Python repo via raw GitHub URL, writing it to `packages/core/tests/fixtures/validity.json` (gitignored).

**Files added to the monorepo:**

- `packages/core/scripts/fetch-fixtures.mjs` — ~30 lines of Node, no dependencies beyond `node:fs` / `node:https`. Reads the pinned tag from `packages/core/package.json`, downloads, verifies HTTP 200, writes atomically (download to `.tmp`, rename), exits non-zero on failure.
- `packages/core/.gitignore` entry: `tests/fixtures/`
- `packages/core/package.json` additions:
  ```json
  {
    "scripts": {
      "fetch-fixtures": "node scripts/fetch-fixtures.mjs"
    },
    "iscn": {
      "fixturesRepo": "nuin/iscn-authenticator-py",
      "fixturesTag": "v0.2.0-py",
      "fixturesPath": "fixtures/validity.json"
    }
  }
  ```

**CI integration:** The TS test step in `.github/workflows/ci.yml` runs `npm run fetch-fixtures` before `deno test`. The fetch script is also invocable locally before running tests.

**Updating fixtures:** Bump the version in the Python repo → publish a new tag → bump `iscn.fixturesTag` in the monorepo's `package.json` → re-run TS tests. The version bump is reviewable in the diff.

### Alternatives considered

- **Git submodule:** heavier, awkward for shallow CI clones, easy to forget to update.
- **NPM package (`@iscn/fixtures`):** YAGNI for a single 30 KB JSON file.
- **Vendored copy + drift check:** historically fragile; relies on a scheduled job to surface drift after the fact.

## 4. PyPI publishing via Trusted Publishing (OIDC)

### PyPI configuration

A trusted publisher must be configured on PyPI for the `iscn-authenticator` project, pointing at:

- Repository owner: `nuin`
- Repository name: `iscn-authenticator`
- Workflow file name: `publish-pypi.yml`
- Environment name: `pypi`

This must be configured *before* the first publish attempt. Configuration is done via the PyPI web UI under Account → Publishing.

### Workflow changes vs the monorepo's existing `publish-pypi.yml`

Starting from `.github/workflows/publish-pypi.yml` in the monorepo:

- **Add** `environment: pypi` to the publish job (matches PyPI's Trusted Publishing config).
- **Keep** `permissions.id-token: write` (already present; required for OIDC).
- **Remove** the `TWINE_USERNAME` / `TWINE_PASSWORD` env block.
- **Replace** the `python -m twine upload --non-interactive dist/*` step with `uses: pypa/gh-action-pypi-publish@release/v1`.
- **Keep** the `verify-pypi-tag.py` step unchanged (it operates on the tag, not on auth).
- **Keep** the wheel smoke test unchanged.
- **Keep** the `twine check` step unchanged.

No `PYPI_TOKEN` secret is created in the new repo. PyPI rejects uploads that do not originate from the configured workflow path + environment, which yields a tighter blast radius than a long-lived token.

## 5. Tooling additions (ruff + pre-commit)

### `pyproject.toml` additions

```toml
[tool.ruff]
target-version = "py310"
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]
# E   = pycodestyle errors
# F   = pyflakes
# I   = isort
# UP  = pyupgrade
# B   = flake8-bugbear
# SIM = flake8-simplify
```

### `.pre-commit-config.yaml`

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks:
      - id: ruff
        args: [--fix]
      - id: ruff-format
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
```

### CI integration in new repo

`.github/workflows/ci.yml` (new file in the extracted repo) runs:

1. `pip install ruff`
2. `ruff check .`
3. `ruff format --check .`
4. `python -m unittest discover tests` across Python 3.10, 3.11, 3.12, 3.13.
5. `pip install build twine && python -m build && python -m twine check dist/*`

Step 5 catches packaging regressions on every PR rather than waiting for the publish workflow to discover them at release time.

### Handling existing violations

If ruff surfaces violations on first run against the current `iscn_authenticator/` and `tests/`, fix them on master *before* extraction begins, as separate commits. This keeps the extraction diff free of unrelated formatting churn.

## 6. Monorepo cleanup (single PR after publish)

### Files and directories deleted

- `iscn_authenticator/` (entire tree)
- `tests/` (entire tree — these test the Python library)
- `fixtures/` (now owned by the new Python repo)
- `pyproject.toml` (top-level — existed solely for PyPI packaging)
- `requirements.txt` (top-level — was for the Python test suite)
- `scripts/verify-pypi-tag.py`
- `scripts/validate_json.py` (recreation post-cutover is out of scope for this spec)
- `.github/workflows/publish-pypi.yml`

### Files updated

- `api/pyproject.toml`: add `iscn-authenticator>=0.2.0,<0.3.0` to `dependencies`.
- `api/requirements.txt`: add `iscn-authenticator>=0.2.0,<0.3.0`.
- `api/Dockerfile`: ensure the build step installs from `requirements.txt` (likely already does).
- `api/server.py`: import line unchanged (`from iscn_authenticator.main import validate_karyotype`).
- `packages/core/package.json`: add `fetch-fixtures` script and `iscn.*` config block per §3.
- `packages/core/.gitignore`: add `tests/fixtures/`.
- `packages/core/tests/fixtures.test.ts`: update path to `./fixtures/validity.json` (relative to the test file's directory).
- `.github/workflows/ci.yml`:
  - Drop the `python-tests` matrix job entirely.
  - Drop the `python-install-smoke` job entirely.
  - Add `npm --prefix packages/core run fetch-fixtures` before any TS test step.
- `README.md`: replace Python-library framing with a brief mention pointing to the standalone repo and PyPI page. The monorepo README's "Architecture" section keeps the TS port and apps; the Python section becomes one paragraph.
- `CHANGELOG.md`:
  - Move the `iscn-authenticator (PyPI)` section out — it becomes the new repo's `CHANGELOG.md`.
  - The file keeps the `@iscn/core (npm)` section (and any future Deno/web entries). It will not be empty after the split, so it is not deleted. Update the header to reflect that it now covers npm + Deno only.
- `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`:
  - Remove all Python sections (Python tests, FastAPI commands kept since `api/` remains, but the `iscn_authenticator/` package itself is gone).
  - Update the monorepo table: drop the `iscn_authenticator/` row; add a note that the Python library now lives at `github.com/nuin/iscn-authenticator-py` and is installed from PyPI.
  - Remove the `tests/test_fixtures.py` row and the parity-test sentence; add a brief note describing the fetch-fixtures sync flow.

### Files untouched

- `iscn_2024.txt`, the ISCN 2024 PDF.
- `deno/` (the TS port already does not import the Python library).
- `packages/web/`.
- Top-level `deno.json`, `deno.lock`.
- `docs/openapi.yaml` and the rest of `docs/`.

## 7. Cutover sequence (atomic flag-day)

Ordered steps. The implementation plan produced by `writing-plans` will expand each step into concrete commands.

1. **Master prep (in the monorepo, before extraction).** Run ruff on `iscn_authenticator/` + `tests/` and fix any violations as one or more commits on master. Run `python -m build` and `python -m twine check dist/*` locally; verify both succeed. Run the full test suite (`python -m unittest discover tests`) one final time.
2. **Create new repo on disk.** `mkdir /Users/nuin/Projects/iscn-authenticator-py && cd $_ && git init`. Copy the files per §2. Add the ruff config to `pyproject.toml`. Add `.pre-commit-config.yaml`. Add the new `.github/workflows/ci.yml`. Adapt `.github/workflows/publish-pypi.yml` per §4. Verify `python -m unittest discover tests` passes locally. Verify `python -m build && python -m twine check dist/*` passes locally. Initial commit.
3. **Push to GitHub.** Create the `nuin/iscn-authenticator-py` repository on GitHub. Push.
4. **Configure PyPI Trusted Publishing.** Via PyPI web UI, register a trusted publisher for the PyPI project `iscn-authenticator` against repo `nuin/iscn-authenticator-py`, workflow `publish-pypi.yml`, environment `pypi`. Create the `pypi` environment in the new repo's GitHub settings (no required reviewers needed; can be added later).
5. **Tag and publish.** `git tag v0.2.0-py && git push origin v0.2.0-py`. Watch the workflow run. On success, verify the project page at `https://pypi.org/project/iscn-authenticator/` renders correctly (README, classifiers, version, links).
6. **Open monorepo PR.** Single PR with every change in §6. CI on the PR:
   - `api/` builds with `iscn-authenticator>=0.2.0` resolving from PyPI.
   - TS port runs `npm run fetch-fixtures` then `deno test` and passes.
   - Python matrix jobs no longer exist; no broken job remains.
7. **Merge.** After the PR merges, run a final manual verification: in a clean throwaway venv, `pip install iscn-authenticator==0.2.0`, then `python -c "from iscn_authenticator import is_valid_karyotype; assert is_valid_karyotype('46,XX')"`.

Step 5 publishes *before* step 6 deletes, so at no commit is any consumer broken.

## 8. Testing and verification

### New repo

- Per-PR CI runs ruff + unittest across Python 3.10–3.13 + `python -m build` + `twine check`.
- Publish workflow runs the wheel smoke test (`from iscn_authenticator import is_valid_karyotype; assert is_valid_karyotype('46,XX')`) before uploading.
- No fixture parity test against the TS port lives here — that test moves to the monorepo side of the fence (it always was on the monorepo side, just under `packages/core/tests/`).

### Monorepo (after cutover)

- TS port fixture parity test runs against fetched fixtures pinned to the published Python tag.
- `api/` Docker build installs `iscn-authenticator` from PyPI.
- No Python jobs remain in `.github/workflows/ci.yml`.

### Manual post-publish

- `pip install iscn-authenticator==0.2.0` in a clean venv.
- Import and run ten representative cases from `fixtures/validity.json`.
- Visit `https://pypi.org/project/iscn-authenticator/` and confirm README, classifiers, version, project links render correctly.

## 9. Risks and rollback

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Trusted Publishing configuration mismatch (workflow path, environment name) causes first publish to be rejected | Medium | Low | First publish is a tag, not a deletion. Recovery: fix the TP config, then push `v0.2.0-py.1` (do not delete and re-push `v0.2.0-py` — moving tags is a footgun on shared branches even though this repo is single-author). Bump `pyproject.toml` to `0.2.0.post1` to match. No monorepo state has changed. |
| `iscn-authenticator` name claimed by another publisher between today and publish day | Low | High | Currently unclaimed (verified via `pypi.org/pypi/iscn-authenticator/json` returning 404). Re-verify immediately before §7 step 5. Fallback names: `iscn-validator`, `iscn-2024-validator`. |
| Monorepo PR's CI fails because PyPI hasn't propagated v0.2.0 yet | Low | Low | Propagation is typically under a minute; retry the CI job. If repeated failures, pin to an explicit version + hash and retry once propagated. |
| Fixture fetch script returns stale data due to CI caching | Low | Medium | Pin to an immutable tag, not a branch. Do not cache `packages/core/tests/fixtures/` in CI. The script fails loudly on HTTP non-200. |
| Need to roll back the extraction entirely | Low | Medium | `git revert` the monorepo PR (restores the Python tree). The PyPI release stays — PyPI does not allow deletion, only yanking. Any future monorepo development that needed the package would `pip install` it from PyPI as if it had always been external. The new GitHub repo can be archived but should not be deleted (PyPI Trusted Publishing config references it). |
| ruff prep commits surface a violation that requires a behavior change | Low | Low | If a `B` or `SIM` rule wants a semantic change, narrow the rule selection for the initial commit; defer the cleanup to a follow-up PR in the new repo. The extraction must not change validation behavior. |

## 10. README rewrite for standalone framing

The new repo's `README.md` is written fresh rather than copied. It covers:

1. **What it is** — one-paragraph summary of ISCN 2024 karyotype validation, zero runtime deps, Python 3.10+.
2. **Install** — `pip install iscn-authenticator`.
3. **Quick start** — `from iscn_authenticator import is_valid_karyotype, validate_karyotype` + 5 example calls covering valid simple, valid complex, invalid, and uncertainty cases.
4. **API surface** — short reference for `is_valid_karyotype`, `validate_karyotype`, `ValidationResult`, and the AST types (`KaryotypeAST`, `Abnormality`, `Breakpoint`, `CellLine`).
5. **Supported nomenclature** — list of abnormality types covered (numerical, del, dup, t, inv, ins, i, idic, der, dic, r, rob, trp, mar) with one-line descriptions.
6. **ISCN 2024 reference** — pointer to the published spec; note that the implementation tracks the 2024 edition.
7. **Cross-implementation parity** — note that a TypeScript port (`@iscn/core`) exists in a separate repo and consumes the same fixture corpus from this repo's `fixtures/validity.json`.
8. **Contributing** — `python -m unittest discover tests`, ruff, pre-commit setup.
9. **License** — MIT.

This README is what shows on the PyPI project page; correctness and renderability matter.

## 11. Out of scope (explicitly deferred)

The following are deliberately not part of this spec. Adding any of them creates scope creep that delays the extraction.

- **CITATION.cff** / Zenodo DOI integration (academic citation surface) — easy to add to the new repo post-extraction.
- **Dependabot / Renovate config** — easy to add post-extraction.
- **GitHub issue / PR templates** — easy to add post-extraction.
- **mypy or strict type checking** — would require type annotation pass on the existing code.
- **`uv` adoption** — orthogonal to the move.
- **TestPyPI dry-run before the real publish** — considered; rejected as ceremony given that `twine check` and the local build already validate the package contents.
- **Republishing the existing `@iscn/core` TypeScript port to npm** — separate concern, separate publish workflow already exists in the monorepo.
- **Library docs site (mkdocs, Sphinx)** — README + docstrings are sufficient for v0.2.0.
- **Recreating `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` in the new repo** — out of scope; can be added later when there is enough non-obvious context to capture.
