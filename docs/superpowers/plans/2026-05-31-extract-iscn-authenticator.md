# Extract iscn_authenticator to Standalone PyPI Repo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Python `iscn_authenticator` library out of this monorepo into a standalone Git repo, publish v0.2.0 to PyPI with Trusted Publishing, and switch the monorepo's `api/` consumer to depend on the published package.

**Architecture:** Two repos. New Python repo at `/Users/nuin/Projects/iscn-authenticator-py/` (GitHub: `nuin/iscn-authenticator-py`; the monorepo continues to occupy `nuin/iscn-authenticator`) owns `iscn_authenticator/`, `tests/`, and `fixtures/validity.json`. The PyPI package name remains `iscn-authenticator`. Monorepo TS port fetches `fixtures/validity.json` from the new repo by pinned tag. Atomic flag-day cutover: publish v0.2.0 first, then a single monorepo PR deletes the Python tree and switches `api/server.py` to `pip install iscn-authenticator`.

**Tech Stack:** Python 3.10–3.13, hatchling, ruff, pre-commit, GitHub Actions, PyPI Trusted Publishing (OIDC), Node (for fetch-fixtures script), Deno (TS port).

**Spec:** `docs/superpowers/specs/2026-05-31-extract-iscn-authenticator-design.md`

---

## Conventions for this plan

- **`[USER]`** prefix marks a step that the human user must perform (PyPI web UI, GitHub web UI, GitHub repo creation requiring credentials, irreversible publish). Pause and wait for confirmation before continuing.
- **`[VERIFY]`** prefix marks a verification step — read the output carefully; halt if unexpected.
- Working directories are written explicitly: `(monorepo)` for `/Users/nuin/Projects/iscn-authenticator/`, `(newrepo)` for `/Users/nuin/Projects/iscn-authenticator-py/`.
- Commit messages omit any AI co-author attribution per the user's CLAUDE.md preference.
- Each task ends with a commit (in either the new repo or a branch of the monorepo). Frequent commits are intentional.

---

## Prerequisites (verify before starting)

Run these in `(monorepo)` once before Task 0.1. If any fail, stop and resolve.

- [ ] `gh auth status` — must show authenticated GitHub user `nuin`.
- [ ] `python3 --version` — must be 3.10 or higher.
- [ ] `pip install --user ruff build twine pre-commit` (or in a venv).
- [ ] You have an active PyPI account at https://pypi.org and can log in.
- [ ] You can reach https://pypi.org (`curl -fsS https://pypi.org/pypi/numpy/json | head -c 50` returns JSON).

---

## File Structure

This section locks the decomposition. Every file mentioned below appears in exactly one task.

### New repo (`/Users/nuin/Projects/iscn-authenticator-py/`)

| File | Origin | Task |
|---|---|---|
| `iscn_authenticator/**` | Verbatim copy from monorepo | 1.2 |
| `tests/**` | Verbatim copy from monorepo | 1.3 |
| `fixtures/validity.json` | Copy from monorepo | 1.4 |
| `LICENSE` | Copy from monorepo | 1.4 |
| `.gitignore` | New file | 1.5 |
| `pyproject.toml` | Adapted from monorepo (+ ruff config) | 1.6 |
| `.pre-commit-config.yaml` | New file | 1.7 |
| `README.md` | New, written fresh | 1.8 |
| `CHANGELOG.md` | Extracted from monorepo CHANGELOG.md | 1.9 |
| `scripts/verify-pypi-tag.py` | Verbatim copy | 1.10 |
| `.github/workflows/ci.yml` | New | 1.11 |
| `.github/workflows/publish-pypi.yml` | Adapted from monorepo (TP variant) | 1.12 |

### Monorepo files modified during cutover

| File | Change | Task |
|---|---|---|
| `packages/core/scripts/fetch-fixtures.mjs` | Create | 4.2 |
| `packages/core/tests/fetch-fixtures.test.mjs` | Create | 4.1 |
| `packages/core/package.json` | Add scripts + iscn block | 4.4 |
| `packages/core/.gitignore` | Add `tests/fixtures/` | 4.5 |
| `packages/core/tests/fixtures.test.ts` | Update fixture path | 4.6 |
| `api/pyproject.toml` | Add dep | 5.2 |
| `api/requirements.txt` | Add dep | 5.2 |
| `.github/workflows/ci.yml` | Drop python jobs, add fetch step | 5.3 |
| `README.md` (monorepo root) | Reframe Python section | 5.11 |
| `CHANGELOG.md` | Move PyPI section out | 5.10 |
| `CLAUDE.md` | Drop Python sections | 5.12 |
| `AGENTS.md` | Drop Python sections | 5.12 |
| `GEMINI.md` | Drop Python sections | 5.12 |

### Monorepo files deleted during cutover

`iscn_authenticator/`, `tests/`, `fixtures/`, top-level `pyproject.toml`, top-level `requirements.txt`, `scripts/verify-pypi-tag.py`, `scripts/validate_json.py`, `.github/workflows/publish-pypi.yml`.

---

# Phase 0 — Master prep (monorepo only, no extraction yet)

Goal: make sure the package can be built cleanly from the current monorepo and that the ruff configuration we're about to adopt produces no surprises.

### Task 0.1: Snapshot the current state and verify name availability

**Files:** none (read-only).

- [ ] **Step 1: Confirm working directory and clean tree**

```bash
cd /Users/nuin/Projects/iscn-authenticator
git status
```
Expected: clean working tree, or only the in-progress spec/CLAUDE.md changes from this session (those are fine). No other unexpected modifications.

- [ ] **Step 2: [VERIFY] Re-verify the PyPI name is still unclaimed**

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" https://pypi.org/pypi/iscn-authenticator/json
```
Expected: `404`. If `200`, STOP — the name was claimed since the spec was written. Pick a fallback (`iscn-validator` or `iscn-2024-validator`), update the spec, and restart.

- [ ] **Step 3: [VERIFY] Run the existing Python test suite**

```bash
python3 -m unittest discover tests
```
Expected: all tests pass. Note the count for comparison after ruff fixes.

### Task 0.2: Install ruff and run against the package

**Files:** none (read-only).

- [ ] **Step 1: Install ruff if not already installed**

```bash
pip install --user 'ruff>=0.6,<0.7' || python3 -m pip install 'ruff>=0.6,<0.7'
ruff --version
```
Expected: version ≥ 0.6.0.

- [ ] **Step 2: Run ruff check with the rule set the new repo will use**

```bash
cd /Users/nuin/Projects/iscn-authenticator
ruff check --select E,F,I,UP,B,SIM iscn_authenticator/ tests/
```
Expected: either passes cleanly, or prints a list of violations. Capture the output. If there are violations, they get fixed in Task 0.3. If clean, skip Task 0.3.

- [ ] **Step 3: Run ruff format check**

```bash
ruff format --check iscn_authenticator/ tests/
```
Expected: either passes cleanly, or prints files needing reformatting. Capture the output.

### Task 0.3: Fix any ruff violations (skip if Task 0.2 was clean)

**Files:** `iscn_authenticator/**.py`, `tests/**.py` — whichever ruff flagged.

- [ ] **Step 1: Apply auto-fixable ruff violations**

```bash
cd /Users/nuin/Projects/iscn-authenticator
ruff check --select E,F,I,UP,B,SIM --fix iscn_authenticator/ tests/
ruff format iscn_authenticator/ tests/
```

- [ ] **Step 2: Inspect the diff**

```bash
git diff --stat iscn_authenticator/ tests/
git diff iscn_authenticator/ tests/ | head -100
```
[VERIFY] No semantic changes — only whitespace, import reordering, f-string conversions, or other cosmetic changes. If `B` or `SIM` rules suggest a real behavior change, revert that hunk; this PR is "extraction only, not behavior changes."

- [ ] **Step 3: Re-run tests to confirm no regression**

```bash
python3 -m unittest discover tests
```
Expected: same pass count as Task 0.1 step 3.

- [ ] **Step 4: Re-run ruff to confirm clean**

```bash
ruff check --select E,F,I,UP,B,SIM iscn_authenticator/ tests/
ruff format --check iscn_authenticator/ tests/
```
Expected: both pass with no output.

- [ ] **Step 5: Commit on master**

```bash
git add iscn_authenticator/ tests/
git commit -m "style: apply ruff formatting and lint fixes before PyPI extraction"
```

### Task 0.4: Verify packaging builds cleanly

**Files:** none (read-only).

- [ ] **Step 1: Build sdist and wheel**

```bash
cd /Users/nuin/Projects/iscn-authenticator
rm -rf dist/
python3 -m build
```
Expected: `dist/iscn_authenticator-0.2.0-py3-none-any.whl` and `dist/iscn_authenticator-0.2.0.tar.gz` exist.

- [ ] **Step 2: [VERIFY] twine check**

```bash
python3 -m twine check dist/*
```
Expected: `PASSED` for both files. If `FAILED`, read the message (usually a README rendering issue) and fix `pyproject.toml` or `README.md` in `(monorepo)` before continuing.

- [ ] **Step 3: [VERIFY] Wheel smoke test in a clean venv**

```bash
python3 -m venv /tmp/iscn-prep-smoke
/tmp/iscn-prep-smoke/bin/pip install --quiet dist/iscn_authenticator-0.2.0-py3-none-any.whl
/tmp/iscn-prep-smoke/bin/python -c "
from iscn_authenticator import is_valid_karyotype
from iscn_authenticator.main import validate_karyotype
assert is_valid_karyotype('46,XX') is True
assert is_valid_karyotype('47,XY,+21') is True
assert is_valid_karyotype('garbage') is False
result = validate_karyotype('46,XX,t(9;22)(q34;q11.2)')
assert result.valid is True
print('smoke ok')
"
rm -rf /tmp/iscn-prep-smoke
```
Expected: prints `smoke ok`. If any assertion fails, STOP — there is a build-vs-source-tree discrepancy that must be diagnosed before extraction.

- [ ] **Step 4: Clean up the dist directory** (it's gitignored, but tidy)

```bash
rm -rf dist/
```

---

# Phase 1 — Build the new repo locally (no push yet)

Goal: produce a fully working `(newrepo)` on disk that passes its own CI before anything touches GitHub or PyPI.

### Task 1.1: Initialize the new repo

**Files:** Create `(newrepo)/`.

- [ ] **Step 1: Create the directory and initialize git**

```bash
mkdir -p /Users/nuin/Projects/iscn-authenticator-py
cd /Users/nuin/Projects/iscn-authenticator-py
git init
git config commit.gpgsign false  # optional; only set if user normally uses GPG and wants to skip for this repo
```

- [ ] **Step 2: Set the default branch name to master**

```bash
cd /Users/nuin/Projects/iscn-authenticator-py
git checkout -b master 2>/dev/null || git symbolic-ref HEAD refs/heads/master
```
Expected: `(newrepo)` exists as an empty git repository on branch `master`.

### Task 1.2: Copy the `iscn_authenticator/` package tree

**Files:** Create `(newrepo)/iscn_authenticator/**`.

- [ ] **Step 1: Copy the package tree**

```bash
cp -r /Users/nuin/Projects/iscn-authenticator/iscn_authenticator /Users/nuin/Projects/iscn-authenticator-py/
find /Users/nuin/Projects/iscn-authenticator-py/iscn_authenticator -name __pycache__ -type d -exec rm -rf {} + 2>/dev/null
```

- [ ] **Step 2: [VERIFY] Confirm the file list matches the original**

```bash
diff <(cd /Users/nuin/Projects/iscn-authenticator && find iscn_authenticator -type f -not -path '*/__pycache__/*' | sort) \
     <(cd /Users/nuin/Projects/iscn-authenticator-py && find iscn_authenticator -type f | sort)
```
Expected: no output (identical file list). If output appears, investigate before continuing.

### Task 1.3: Copy the `tests/` tree

**Files:** Create `(newrepo)/tests/**`.

- [ ] **Step 1: Copy the tests tree**

```bash
cp -r /Users/nuin/Projects/iscn-authenticator/tests /Users/nuin/Projects/iscn-authenticator-py/
find /Users/nuin/Projects/iscn-authenticator-py/tests -name __pycache__ -type d -exec rm -rf {} + 2>/dev/null
```

- [ ] **Step 2: [VERIFY] Confirm `test_fixtures.py` still references the right path**

```bash
grep -n FIXTURES_PATH /Users/nuin/Projects/iscn-authenticator-py/tests/test_fixtures.py
```
Expected: line reads `pathlib.Path(__file__).resolve().parent.parent / "fixtures" / "validity.json"` — this remains correct in the new repo because `tests/` is still a sibling of `fixtures/`.

### Task 1.4: Copy `fixtures/validity.json` and `LICENSE`

**Files:** Create `(newrepo)/fixtures/validity.json`, `(newrepo)/LICENSE`.

- [ ] **Step 1: Copy fixtures**

```bash
mkdir -p /Users/nuin/Projects/iscn-authenticator-py/fixtures
cp /Users/nuin/Projects/iscn-authenticator/fixtures/validity.json /Users/nuin/Projects/iscn-authenticator-py/fixtures/
```

- [ ] **Step 2: Copy LICENSE**

```bash
cp /Users/nuin/Projects/iscn-authenticator/LICENSE /Users/nuin/Projects/iscn-authenticator-py/
```

- [ ] **Step 3: [VERIFY] Both files exist and are non-empty**

```bash
ls -la /Users/nuin/Projects/iscn-authenticator-py/fixtures/validity.json /Users/nuin/Projects/iscn-authenticator-py/LICENSE
```

### Task 1.5: Write `.gitignore`

**Files:** Create `(newrepo)/.gitignore`.

- [ ] **Step 1: Write the file**

Create `/Users/nuin/Projects/iscn-authenticator-py/.gitignore` with this content:

```
# Python
__pycache__/
*.py[cod]
*$py.class
*.egg-info/
*.egg
build/
dist/
.eggs/
pip-wheel-metadata/

# Virtual environments
.venv/
venv/
env/
ENV/

# Testing & coverage
.coverage
.coverage.*
htmlcov/
.pytest_cache/
.tox/
.mypy_cache/
.ruff_cache/

# Editors / OS
.idea/
.vscode/
*.swp
*.swo
.DS_Store

# Local-only outputs
/scratch/
```

### Task 1.6: Adapt `pyproject.toml` (fix URLs + add ruff config)

**Files:** Create `(newrepo)/pyproject.toml`.

- [ ] **Step 1: Copy the existing pyproject.toml**

```bash
cp /Users/nuin/Projects/iscn-authenticator/pyproject.toml /Users/nuin/Projects/iscn-authenticator-py/pyproject.toml
```

- [ ] **Step 2: Update the `[project.urls]` block to point at the new repo**

In `/Users/nuin/Projects/iscn-authenticator-py/pyproject.toml`, the existing block looks like:

```toml
[project.urls]
Homepage = "https://iscn.bioinformat.com"
Repository = "https://github.com/nuin/iscn-authenticator"
Issues = "https://github.com/nuin/iscn-authenticator/issues"
Changelog = "https://github.com/nuin/iscn-authenticator/blob/master/CHANGELOG.md"
Documentation = "https://github.com/nuin/iscn-authenticator#readme"
```

Change `Repository`, `Issues`, `Changelog`, and `Documentation` to point at the new repo. The result must be exactly:

```toml
[project.urls]
Homepage = "https://iscn.bioinformat.com"
Repository = "https://github.com/nuin/iscn-authenticator-py"
Issues = "https://github.com/nuin/iscn-authenticator-py/issues"
Changelog = "https://github.com/nuin/iscn-authenticator-py/blob/master/CHANGELOG.md"
Documentation = "https://github.com/nuin/iscn-authenticator-py#readme"
```

`Homepage` stays pointing at the hosted product (`iscn.bioinformat.com`) — that URL belongs to the service, not the library.

- [ ] **Step 3: Append the ruff configuration**

Append to `/Users/nuin/Projects/iscn-authenticator-py/pyproject.toml`:

```toml

[tool.ruff]
target-version = "py310"
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]
```

- [ ] **Step 4: [VERIFY] Validate the file parses and contains the new URLs**

```bash
python3 -c "
import tomllib
data = tomllib.loads(open('/Users/nuin/Projects/iscn-authenticator-py/pyproject.toml').read())
urls = data['project']['urls']
assert urls['Repository'] == 'https://github.com/nuin/iscn-authenticator-py', urls['Repository']
assert urls['Issues'].startswith('https://github.com/nuin/iscn-authenticator-py'), urls['Issues']
assert data['tool']['ruff']['lint']['select'] == ['E', 'F', 'I', 'UP', 'B', 'SIM']
print('ok')
"
```
Expected: `ok`.

### Task 1.7: Write `.pre-commit-config.yaml`

**Files:** Create `(newrepo)/.pre-commit-config.yaml`.

- [ ] **Step 1: Write the file**

Create `/Users/nuin/Projects/iscn-authenticator-py/.pre-commit-config.yaml` with:

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
      - id: check-yaml
      - id: check-toml
      - id: check-added-large-files
        args: [--maxkb=200]
```

### Task 1.8: Write `README.md`

**Files:** Create `(newrepo)/README.md`.

- [ ] **Step 1: Write the README**

Create `/Users/nuin/Projects/iscn-authenticator-py/README.md` with the structure from the spec §10. Content:

````markdown
# iscn-authenticator

ISCN 2024 karyotype validation — parser, rule engine, and AST types. Pure Python, zero runtime dependencies, supports Python 3.10–3.13.

> Validates karyotype strings against the 2024 International System for Human Cytogenomic Nomenclature (ISCN) and returns a structured AST alongside any rule violations.

## Install

```bash
pip install iscn-authenticator
```

## Quick start

```python
from iscn_authenticator import is_valid_karyotype, validate_karyotype

is_valid_karyotype("46,XX")                              # True
is_valid_karyotype("47,XY,+21")                          # True
is_valid_karyotype("46,XX,t(9;22)(q34;q11.2)")           # True
is_valid_karyotype("47,XY,+21[8]/46,XY[12]")             # True (mosaic)
is_valid_karyotype("garbage")                            # False

result = validate_karyotype("46,XX,del(5)(q13q33)")
# result.valid   -> True
# result.errors  -> []
# result.parsed  -> KaryotypeAST(...)
```

## API surface

- `validate_karyotype(s: str) -> ValidationResult` — full validation, returns `{valid, errors, parsed}`.
- `is_valid_karyotype(s: str) -> bool` — boolean convenience wrapper.
- `KaryotypeAST`, `Abnormality`, `Breakpoint`, `CellLine` — dataclasses describing the parsed structure.
- `ParseError` — raised by the parser on malformed syntax; `validate_karyotype` catches it and surfaces it through `errors`.

## Supported nomenclature

ISCN 2024 grammar covered:

- Numerical aberrations: `+21`, `-X`, ...
- Structural rearrangements: `del`, `dup`, `inv`, `t` (translocation), `ins` (insertion).
- Specialized rearrangements: `i` (isochromosome), `idic` (isodicentric), `der` (derivative), `dic` (dicentric), `r` (ring), `rob` (Robertsonian), `trp` (triplication).
- Marker chromosomes: `mar`.
- Uncertainty (`?`), inheritance suffixes (`mat`, `pat`, `dn`), mosaicism (cell lines split on `/`).

## ISCN 2024 reference

Implementation tracks the 2024 edition of the International System for Human Cytogenomic Nomenclature. See the [ISCN publication](https://karger.com/books/book/277/ISCN-2024).

## Cross-implementation parity

A TypeScript port (`@iscn/core`) lives in the [iscn-authenticator monorepo](https://github.com/nuin/iscn-authenticator) under `packages/core/`, and consumes the same fixture corpus shipped in this repo at `fixtures/validity.json`. Parity is enforced via CI in both repos.

## Contributing

```bash
git clone https://github.com/nuin/iscn-authenticator-py.git
cd iscn-authenticator-py
pip install pre-commit ruff
pre-commit install
python3 -m unittest discover tests
```

## License

MIT — see `LICENSE`.
````

### Task 1.9: Extract the PyPI changelog section

**Files:** Create `(newrepo)/CHANGELOG.md`.

- [ ] **Step 1: Write the new CHANGELOG**

Create `/Users/nuin/Projects/iscn-authenticator-py/CHANGELOG.md` with:

```markdown
# Changelog

All notable changes to `iscn-authenticator` are recorded here. The format
roughly follows [Keep a Changelog](https://keepachangelog.com/); versions
are [SemVer](https://semver.org/) and on `0.x` a breaking change bumps
the minor.

Sections per release: **Added**, **Changed**, **Fixed**, **Removed**.

---

## 0.2.0 — 2026-04

First release tracked in this changelog. First release published to PyPI.

### Added
- ISCN 2024 grammar coverage: numerical aberrations (`+`/`-`), deletions
  (`del`), duplications (`dup`), translocations (`t`), inversions
  (`inv`), insertions (`ins`), isochromosomes (`i`/`idic`),
  derivatives (`der`/`dic`), rings (`r`), Robertsonian translocations
  (`rob`), triplications (`trp`), marker chromosomes (`mar`),
  uncertainty (`?`), inheritance suffixes (`mat`/`pat`/`dn`),
  mosaicism (cell lines split on `/`).
- AST + rule-engine architecture (`KaryotypeParser` →
  `KaryotypeAST` → `RuleEngine`); rules split into chromosome-level
  and abnormality-level lists.
- `validate_karyotype(s) -> ValidationResult` (`{ valid, errors, parsed }`)
  and `is_valid_karyotype(s) -> bool` convenience wrapper.
- Shared fixture corpus at `fixtures/validity.json` exercising both this
  library and the TypeScript port.

### Notes
- Zero runtime dependencies; standard library only.
- Supports Python 3.10–3.13.
- This release is the result of extracting the library from the original
  monorepo at `github.com/nuin/iscn-authenticator`. Earlier development
  history is not preserved in this repository.
```

### Task 1.10: Copy `verify-pypi-tag.py`

**Files:** Create `(newrepo)/scripts/verify-pypi-tag.py`.

- [ ] **Step 1: Copy the script**

```bash
mkdir -p /Users/nuin/Projects/iscn-authenticator-py/scripts
cp /Users/nuin/Projects/iscn-authenticator/scripts/verify-pypi-tag.py /Users/nuin/Projects/iscn-authenticator-py/scripts/
chmod +x /Users/nuin/Projects/iscn-authenticator-py/scripts/verify-pypi-tag.py
```

- [ ] **Step 2: [VERIFY] The script still resolves paths correctly in the new repo**

```bash
cd /Users/nuin/Projects/iscn-authenticator-py
GITHUB_REF_NAME=v0.2.0-py python3 scripts/verify-pypi-tag.py && echo "OK"
```
Expected: prints `OK` (verifying that the tag-version match logic works against the new repo's `pyproject.toml`).

- [ ] **Step 3: [VERIFY] The script rejects a `-py-client` tag**

```bash
cd /Users/nuin/Projects/iscn-authenticator-py
GITHUB_REF_NAME=v0.2.0-py-client python3 scripts/verify-pypi-tag.py; echo "exit=$?"
```
Expected: non-zero exit. The `-py-client` reject was relevant in the monorepo (where multiple Python packages might publish); in the standalone repo it is harmless and we leave it in for defense-in-depth.

### Task 1.11: Write the new repo's `ci.yml`

**Files:** Create `(newrepo)/.github/workflows/ci.yml`.

- [ ] **Step 1: Create the workflows directory**

```bash
mkdir -p /Users/nuin/Projects/iscn-authenticator-py/.github/workflows
```

- [ ] **Step 2: Write `ci.yml`**

Create `/Users/nuin/Projects/iscn-authenticator-py/.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  push:
    branches: [master, main]
  pull_request:
    branches: [master, main]

jobs:
  lint:
    name: Lint (ruff)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Install ruff
        run: pip install 'ruff>=0.6,<0.7'
      - name: ruff check
        run: ruff check .
      - name: ruff format --check
        run: ruff format --check .

  test:
    name: Tests (Python ${{ matrix.python-version }})
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        python-version: ["3.10", "3.11", "3.12", "3.13"]
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python ${{ matrix.python-version }}
        uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
      - name: Run tests
        run: python -m unittest discover tests -v

  packaging:
    name: Packaging smoke (build + twine check)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - name: Install build tooling
        run: pip install build twine
      - name: Build sdist + wheel
        run: python -m build
      - name: twine check
        run: python -m twine check dist/*
```

### Task 1.12: Adapt `publish-pypi.yml` for Trusted Publishing

**Files:** Create `(newrepo)/.github/workflows/publish-pypi.yml`.

- [ ] **Step 1: Copy the monorepo's existing workflow as a starting point**

```bash
cp /Users/nuin/Projects/iscn-authenticator/.github/workflows/publish-pypi.yml /Users/nuin/Projects/iscn-authenticator-py/.github/workflows/
```

- [ ] **Step 2: Replace with the Trusted Publishing variant**

Overwrite `/Users/nuin/Projects/iscn-authenticator-py/.github/workflows/publish-pypi.yml` with:

```yaml
name: Publish iscn-authenticator to PyPI

on:
  push:
    tags:
      - "v*-py"
      # Avoid matching v*-py-client (handled by a different workflow if it ever exists).
      - "!v*-py-client"

jobs:
  publish:
    name: Build and publish
    runs-on: ubuntu-latest
    environment: pypi
    permissions:
      contents: read
      id-token: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python 3.12
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Verify tag matches pyproject.toml version
        env:
          GITHUB_REF_NAME: ${{ github.ref_name }}
        run: python scripts/verify-pypi-tag.py

      - name: Install build tooling
        run: python -m pip install --upgrade build twine

      - name: Build sdist + wheel
        run: python -m build

      - name: twine check
        run: python -m twine check dist/*

      - name: Smoke test wheel
        run: |
          python -m venv /tmp/smoke
          /tmp/smoke/bin/pip install dist/*.whl
          /tmp/smoke/bin/python -c "
          from iscn_authenticator import is_valid_karyotype
          assert is_valid_karyotype('46,XX') is True
          print('smoke ok')
          "

      - name: Publish to PyPI (Trusted Publishing / OIDC)
        uses: pypa/gh-action-pypi-publish@release/v1
```

### Task 1.13: Verify the new repo works end-to-end locally

**Files:** none (verification only).

- [ ] **Step 1: Run the test suite in the new repo**

```bash
cd /Users/nuin/Projects/iscn-authenticator-py
python3 -m unittest discover tests
```
Expected: same pass count as Task 0.1 step 3. If different, investigate.

- [ ] **Step 2: Run ruff check + format check**

```bash
cd /Users/nuin/Projects/iscn-authenticator-py
ruff check .
ruff format --check .
```
Expected: both pass (we ran the auto-fix in Task 0.3 so they should be clean).

- [ ] **Step 3: Run the packaging smoke test**

```bash
cd /Users/nuin/Projects/iscn-authenticator-py
rm -rf dist/
python3 -m build
python3 -m twine check dist/*
```
Expected: `PASSED` for both files.

- [ ] **Step 4: Wheel install smoke**

```bash
python3 -m venv /tmp/iscn-new-smoke
/tmp/iscn-new-smoke/bin/pip install --quiet dist/iscn_authenticator-0.2.0-py3-none-any.whl
/tmp/iscn-new-smoke/bin/python -c "
from iscn_authenticator import is_valid_karyotype
assert is_valid_karyotype('46,XX') is True
assert is_valid_karyotype('garbage') is False
print('smoke ok')
"
rm -rf /tmp/iscn-new-smoke
```
Expected: `smoke ok`.

- [ ] **Step 5: Clean dist**

```bash
rm -rf /Users/nuin/Projects/iscn-authenticator-py/dist
```

### Task 1.14: Initial commit in the new repo

**Files:** all files in `(newrepo)`.

- [ ] **Step 1: Stage everything**

```bash
cd /Users/nuin/Projects/iscn-authenticator-py
git add -A
git status
```
[VERIFY] Confirm no `__pycache__/`, no `dist/`, no `.venv/` is staged. If anything sensitive appears, stop and add to `.gitignore` first.

- [ ] **Step 2: Commit**

```bash
git commit -m "Initial commit: iscn-authenticator v0.2.0 extracted from monorepo"
```

---

# Phase 2 — Push to GitHub and configure PyPI Trusted Publishing

Goal: get the new repo onto GitHub and configure PyPI to accept publishes from it. No tag is pushed yet.

### Task 2.1: Create the GitHub repository

**Files:** none.

- [ ] **Step 1: `[USER]` Verify the GitHub repo name is available**

```bash
gh repo view nuin/iscn-authenticator-py 2>&1 | head -3
```
Expected: `GraphQL: Could not resolve to a Repository with the name 'nuin/iscn-authenticator-py'.` (i.e., does not exist).

If it exists already (e.g., previously created and abandoned), STOP. The user must decide: rename the new repo, or delete the existing one (destructive — confirm separately).

- [ ] **Step 2: `[USER]` Create the repo on GitHub**

```bash
gh repo create nuin/iscn-authenticator-py \
  --public \
  --description "ISCN 2024 karyotype validation — pure Python, zero dependencies. Extracted from nuin/iscn-authenticator monorepo." \
  --homepage "https://pypi.org/project/iscn-authenticator/"
```
Expected: prints `https://github.com/nuin/iscn-authenticator-py`. If the user prefers `--private`, that's fine — Trusted Publishing works either way.

### Task 2.2: Push the repo

**Files:** none.

- [ ] **Step 1: Add remote and push**

```bash
cd /Users/nuin/Projects/iscn-authenticator-py
git remote add origin git@github.com:nuin/iscn-authenticator-py.git
git push -u origin master
```
Expected: push succeeds. If SSH key not set up, use the HTTPS URL `https://github.com/nuin/iscn-authenticator-py.git` instead.

- [ ] **Step 2: [VERIFY] Confirm CI runs on the master push**

```bash
gh run list --repo nuin/iscn-authenticator-py --limit 1
```
Expected: a workflow run for `CI` was created and is `in_progress` or `completed`. Wait for it.

```bash
gh run watch --repo nuin/iscn-authenticator-py
```
Expected: all three CI jobs (lint, test matrix, packaging) succeed. If any fail, STOP and fix in the new repo before continuing.

### Task 2.3: Create the `pypi` GitHub environment

**Files:** none.

- [ ] **Step 1: `[USER]` Create the environment**

Via GitHub web UI: Repo → Settings → Environments → New environment → Name: `pypi` → Configure environment → Save (no required reviewers needed; can be added later if desired).

Alternative via API:

```bash
gh api -X PUT repos/nuin/iscn-authenticator-py/environments/pypi
```
Expected: returns the environment object.

### Task 2.4: Configure PyPI Trusted Publishing

**Files:** none — PyPI configuration only.

- [ ] **Step 1: `[USER]` Log into PyPI and add a pending trusted publisher**

Since the project doesn't exist on PyPI yet, this is a "pending publisher". Go to https://pypi.org → Account → Publishing → Add a new pending publisher. Fill in:

| Field | Value |
|---|---|
| PyPI Project Name | `iscn-authenticator` |
| Owner | `nuin` |
| Repository name | `iscn-authenticator-py` |
| Workflow name | `publish-pypi.yml` |
| Environment name | `pypi` |

Click "Add".

- [ ] **Step 2: [VERIFY] Re-verify name still unclaimed**

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" https://pypi.org/pypi/iscn-authenticator/json
```
Expected: still `404`. (Adding a pending publisher does not claim the name.)

---

# Phase 3 — Publish v0.2.0 to PyPI

Goal: actually publish. **This step is irreversible: once a version is on PyPI, it cannot be deleted, only yanked.** Halt before Step 2 and confirm with the user.

### Task 3.1: Pre-publish checklist

**Files:** none (verification only).

- [ ] **Step 1: [VERIFY] Confirm Phase 2 CI is green**

```bash
gh run list --repo nuin/iscn-authenticator-py --limit 3
```
Expected: most recent CI runs are `completed` with `success`. If not, fix first.

- [ ] **Step 2: [VERIFY] Final PyPI name check**

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" https://pypi.org/pypi/iscn-authenticator/json
```
Expected: `404`.

- [ ] **Step 3: [VERIFY] Confirm `pyproject.toml` version is 0.2.0**

```bash
grep '^version' /Users/nuin/Projects/iscn-authenticator-py/pyproject.toml
```
Expected: `version = "0.2.0"`.

### Task 3.2: Tag and trigger the publish workflow

**Files:** none.

- [ ] **Step 1: `[USER]` Pause point — confirm with user before pushing the tag**

Print a clear prompt:

> About to push tag `v0.2.0-py` to `nuin/iscn-authenticator-py`. This will trigger the publish workflow, which uploads to PyPI. **Once published, the version cannot be deleted (only yanked).** Confirm to proceed.

Wait for explicit user confirmation.

- [ ] **Step 2: Push the tag**

```bash
cd /Users/nuin/Projects/iscn-authenticator-py
git tag -a v0.2.0-py -m "Release v0.2.0 (PyPI)"
git push origin v0.2.0-py
```

- [ ] **Step 3: Watch the publish workflow**

```bash
gh run watch --repo nuin/iscn-authenticator-py
```
Expected: workflow `Publish iscn-authenticator to PyPI` succeeds. If it fails:

- **Tag verification fails:** check `pyproject.toml` version matches the tag (`v0.2.0-py` → `0.2.0`).
- **Trusted Publishing rejects:** verify the TP config on PyPI exactly matches (project name, owner, repo, workflow filename `publish-pypi.yml`, environment `pypi`).
- **`twine check` fails:** read the message, fix in the new repo, commit, push tag `v0.2.0-py.1` and bump `pyproject.toml` to `0.2.0.post1` per the spec's risk-row recovery procedure.

### Task 3.3: Post-publish verification

**Files:** none.

- [ ] **Step 1: [VERIFY] PyPI project page renders**

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" https://pypi.org/project/iscn-authenticator/
```
Expected: `200`.

- [ ] **Step 2: [VERIFY] PyPI JSON API has the release**

```bash
curl -fsS https://pypi.org/pypi/iscn-authenticator/0.2.0/json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['info']['name'], d['info']['version'])"
```
Expected: `iscn-authenticator 0.2.0`.

- [ ] **Step 3: [VERIFY] Install from PyPI in a clean venv**

```bash
python3 -m venv /tmp/iscn-pypi-smoke
/tmp/iscn-pypi-smoke/bin/pip install iscn-authenticator==0.2.0
/tmp/iscn-pypi-smoke/bin/python -c "
from iscn_authenticator import is_valid_karyotype
from iscn_authenticator.main import validate_karyotype
assert is_valid_karyotype('46,XX') is True
assert is_valid_karyotype('47,XY,+21') is True
assert is_valid_karyotype('garbage') is False
result = validate_karyotype('46,XX,t(9;22)(q34;q11.2)')
assert result.valid is True
print('PyPI smoke ok')
"
rm -rf /tmp/iscn-pypi-smoke
```
Expected: `PyPI smoke ok`.

- [ ] **Step 4: [VERIFY] PyPI page README rendering**

Open `https://pypi.org/project/iscn-authenticator/` in a browser. Check that:
- README content is rendered (not raw markdown).
- Project URLs (Homepage, Repository, Issues, Changelog, Documentation) are clickable.
- Classifiers section shows Python 3.10–3.13.

If README renders as raw markdown, the long_description content type is misconfigured (check `pyproject.toml` `readme = "README.md"` setting and `twine check` output). Fix and republish as `0.2.0.post1`.

---

# Phase 4 — Build fetch-fixtures in the monorepo (TDD applies here)

Goal: in the monorepo, build the small Node script that pulls `fixtures/validity.json` from the new repo's pinned tag. Done on a branch — not merged yet. After Phase 4 the monorepo can fetch fixtures, but the Python tree has not yet been deleted.

### Task 4.1: Write failing test for `fetch-fixtures.mjs`

**Files:** Create `(monorepo)/packages/core/tests/fetch-fixtures.test.mjs`.

- [ ] **Step 1: Create a feature branch in the monorepo**

```bash
cd /Users/nuin/Projects/iscn-authenticator
git checkout -b extract-python-library-cutover
```

- [ ] **Step 2: Write the failing test**

Create `/Users/nuin/Projects/iscn-authenticator/packages/core/tests/fetch-fixtures.test.mjs` with:

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "..", "scripts", "fetch-fixtures.mjs");
const TARGET = path.join(__dirname, "fixtures", "validity.json");

test("fetch-fixtures downloads validity.json from the pinned tag", () => {
  rmSync(TARGET, { force: true });

  const result = spawnSync("node", [SCRIPT], {
    encoding: "utf8",
    cwd: path.join(__dirname, ".."),
  });

  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.ok(existsSync(TARGET), "validity.json should exist after fetch");

  const parsed = JSON.parse(readFileSync(TARGET, "utf8"));
  assert.ok(Array.isArray(parsed.valid), "expected `valid` array");
  assert.ok(Array.isArray(parsed.invalid), "expected `invalid` array");
  assert.ok(parsed.valid.length > 0, "expected non-empty valid array");
});

test("fetch-fixtures fails loudly when given a bogus tag via env override", () => {
  rmSync(TARGET, { force: true });

  const result = spawnSync("node", [SCRIPT], {
    encoding: "utf8",
    cwd: path.join(__dirname, ".."),
    env: { ...process.env, ISCN_FIXTURES_TAG_OVERRIDE: "v0.0.0-nonexistent" },
  });

  assert.notEqual(result.status, 0, "script should exit non-zero on 404");
  assert.match(result.stderr, /404|not found/i, "stderr should mention the failure");
  assert.ok(!existsSync(TARGET), "validity.json should not be left behind on failure");
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd /Users/nuin/Projects/iscn-authenticator/packages/core
node --test tests/fetch-fixtures.test.mjs
```
Expected: FAIL — script does not exist yet.

### Task 4.2: Implement `fetch-fixtures.mjs`

**Files:** Create `(monorepo)/packages/core/scripts/fetch-fixtures.mjs`.

- [ ] **Step 1: Write the script**

Create `/Users/nuin/Projects/iscn-authenticator/packages/core/scripts/fetch-fixtures.mjs` with:

```javascript
#!/usr/bin/env node
// Fetch fixtures/validity.json from the iscn-authenticator Python repo at a pinned tag.
// Pin is read from this package's package.json `iscn` block.

import { writeFileSync, renameSync, rmSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_JSON = path.join(__dirname, "..", "package.json");
const OUT_DIR = path.join(__dirname, "..", "tests", "fixtures");
const OUT_FILE = path.join(OUT_DIR, "validity.json");
const TMP_FILE = OUT_FILE + ".tmp";

function fail(msg) {
  console.error(`fetch-fixtures: ${msg}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(PKG_JSON, "utf8"));
const cfg = pkg.iscn;
if (!cfg || !cfg.fixturesRepo || !cfg.fixturesPath) {
  fail("package.json is missing the `iscn` config block (fixturesRepo, fixturesTag, fixturesPath).");
}

const tag = process.env.ISCN_FIXTURES_TAG_OVERRIDE || cfg.fixturesTag;
if (!tag) {
  fail("no fixturesTag in package.json `iscn` block and no ISCN_FIXTURES_TAG_OVERRIDE env var.");
}

const url = `https://raw.githubusercontent.com/${cfg.fixturesRepo}/refs/tags/${encodeURIComponent(tag)}/${cfg.fixturesPath}`;

console.log(`fetch-fixtures: GET ${url}`);

let response;
try {
  response = await fetch(url);
} catch (err) {
  fail(`network error: ${err.message}`);
}

if (!response.ok) {
  fail(`HTTP ${response.status} (${response.statusText || "not found"}) for ${url}`);
}

const body = await response.text();
if (!body.trim()) {
  fail("response body was empty");
}

// Validate it's actually JSON before writing
try {
  JSON.parse(body);
} catch (err) {
  fail(`response is not valid JSON: ${err.message}`);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(TMP_FILE, body);
renameSync(TMP_FILE, OUT_FILE);

console.log(`fetch-fixtures: wrote ${OUT_FILE} (${body.length} bytes, tag ${tag})`);
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x /Users/nuin/Projects/iscn-authenticator/packages/core/scripts/fetch-fixtures.mjs
```

### Task 4.3: Configure `package.json` with the `iscn` block

**Files:** Modify `(monorepo)/packages/core/package.json`.

- [ ] **Step 1: Read the current package.json**

```bash
cat /Users/nuin/Projects/iscn-authenticator/packages/core/package.json
```

- [ ] **Step 2: Add `fetch-fixtures` script and `iscn` block**

Edit `/Users/nuin/Projects/iscn-authenticator/packages/core/package.json`:

- In the existing `"scripts"` object, add: `"fetch-fixtures": "node scripts/fetch-fixtures.mjs"`.
- At top level (after `"scripts"`), add a new `"iscn"` block:

```json
"iscn": {
  "fixturesRepo": "nuin/iscn-authenticator-py",
  "fixturesTag": "v0.2.0-py",
  "fixturesPath": "fixtures/validity.json"
}
```

[VERIFY] `node -e "JSON.parse(require('fs').readFileSync('packages/core/package.json'))"` — should produce no output.

### Task 4.4: Add `tests/fixtures/` to `.gitignore`

**Files:** Modify `(monorepo)/packages/core/.gitignore` (create if absent).

- [ ] **Step 1: Check whether the file exists**

```bash
ls /Users/nuin/Projects/iscn-authenticator/packages/core/.gitignore 2>&1
```

- [ ] **Step 2: Append the ignore rule**

If the file does not exist, create it with the single line `tests/fixtures/`. If it exists, append `tests/fixtures/` (with a leading newline if necessary so the line is not concatenated).

```bash
echo "" >> /Users/nuin/Projects/iscn-authenticator/packages/core/.gitignore
echo "# Fetched at test time from the iscn-authenticator Python repo" >> /Users/nuin/Projects/iscn-authenticator/packages/core/.gitignore
echo "tests/fixtures/" >> /Users/nuin/Projects/iscn-authenticator/packages/core/.gitignore
```

### Task 4.5: Run the fetch-fixtures test to verify it now passes

**Files:** none (test only).

- [ ] **Step 1: Run the test**

```bash
cd /Users/nuin/Projects/iscn-authenticator/packages/core
node --test tests/fetch-fixtures.test.mjs
```
Expected: both tests PASS. (Requires network access to GitHub and v0.2.0-py tag to exist on the new repo — which is true after Phase 3.)

- [ ] **Step 2: [VERIFY] The fetched file exists and matches the original**

```bash
diff /Users/nuin/Projects/iscn-authenticator/fixtures/validity.json \
     /Users/nuin/Projects/iscn-authenticator/packages/core/tests/fixtures/validity.json
```
Expected: no output (identical). This confirms the new repo published the exact same fixtures.

### Task 4.6: Update `fixtures.test.ts` to read from the fetched path

**Files:** Modify `(monorepo)/packages/core/tests/fixtures.test.ts`.

- [ ] **Step 1: Edit the path constant**

In `/Users/nuin/Projects/iscn-authenticator/packages/core/tests/fixtures.test.ts`, find this line:

```typescript
const fixturesUrl = new URL("../../../fixtures/validity.json", import.meta.url);
```

Replace with:

```typescript
const fixturesUrl = new URL("./fixtures/validity.json", import.meta.url);
```

The `./fixtures/` path is relative to the test file's own directory (`packages/core/tests/`), which is exactly where `fetch-fixtures.mjs` writes the file (`packages/core/tests/fixtures/validity.json`).

- [ ] **Step 2: [VERIFY] Confirm the only change**

```bash
git -C /Users/nuin/Projects/iscn-authenticator diff packages/core/tests/fixtures.test.ts
```
Expected: a single-line change, swapping `../../../fixtures/validity.json` for `./fixtures/validity.json`. Nothing else.

- [ ] **Step 3: [VERIFY] Deno test passes with the fetched fixtures**

```bash
cd /Users/nuin/Projects/iscn-authenticator/packages/core
rm -rf tests/fixtures
node scripts/fetch-fixtures.mjs
deno test --allow-read --unstable-sloppy-imports tests/fixtures.test.ts
```
Expected: PASS.

### Task 4.7: Commit Phase 4

**Files:** stage everything added in Phase 4.

- [ ] **Step 1: Commit**

```bash
cd /Users/nuin/Projects/iscn-authenticator
git add packages/core/scripts/fetch-fixtures.mjs \
        packages/core/tests/fetch-fixtures.test.mjs \
        packages/core/package.json \
        packages/core/.gitignore \
        packages/core/tests/fixtures.test.ts
git status
git commit -m "feat(core): fetch fixtures from external iscn-authenticator repo"
```

---

# Phase 5 — Monorepo cleanup PR (single PR, multiple commits)

Goal: in the same branch from Phase 4, perform all deletions and consumer rewires that make the monorepo a Python-free repo. Each task is one logical commit; the PR aggregates them.

### Task 5.1: Add PyPI dep to `api/`

**Files:** Modify `(monorepo)/api/pyproject.toml`, `(monorepo)/api/requirements.txt`.

- [ ] **Step 1: Add the dep to `api/pyproject.toml`**

In `/Users/nuin/Projects/iscn-authenticator/api/pyproject.toml`, change:

```toml
dependencies = [
    "fastapi>=0.104.0",
    "uvicorn[standard]>=0.24.0",
    "pydantic>=2.0.0",
]
```

to:

```toml
dependencies = [
    "fastapi>=0.104.0",
    "uvicorn[standard]>=0.24.0",
    "pydantic>=2.0.0",
    "iscn-authenticator>=0.2.0,<0.3.0",
]
```

- [ ] **Step 2: Add the dep to `api/requirements.txt`**

Append a line to `/Users/nuin/Projects/iscn-authenticator/api/requirements.txt`:

```
iscn-authenticator>=0.2.0,<0.3.0
```

- [ ] **Step 3: [VERIFY] api/ resolves with the new dep in a clean venv**

```bash
python3 -m venv /tmp/iscn-api-smoke
/tmp/iscn-api-smoke/bin/pip install --quiet -r /Users/nuin/Projects/iscn-authenticator/api/requirements.txt
/tmp/iscn-api-smoke/bin/python -c "from iscn_authenticator.main import validate_karyotype; print(validate_karyotype('46,XX').valid)"
rm -rf /tmp/iscn-api-smoke
```
Expected: `True`.

- [ ] **Step 4: Commit**

```bash
cd /Users/nuin/Projects/iscn-authenticator
git add api/pyproject.toml api/requirements.txt
git commit -m "build(api): depend on iscn-authenticator from PyPI"
```

### Task 5.2: Drop Python jobs from monorepo `ci.yml`

**Files:** Modify `(monorepo)/.github/workflows/ci.yml`.

- [ ] **Step 1: Inspect current ci.yml**

```bash
grep -n '^  [a-z]' /Users/nuin/Projects/iscn-authenticator/.github/workflows/ci.yml
```
Expected: lists job IDs including `python-tests`, `python-install-smoke`.

- [ ] **Step 2: Delete the `python-tests` and `python-install-smoke` jobs in their entirety**

Remove the YAML blocks for both jobs from `/Users/nuin/Projects/iscn-authenticator/.github/workflows/ci.yml`. Each job block includes its `name`, `runs-on`, `strategy`/`matrix` (if any), and `steps`. After removal, only non-Python jobs (Deno, Node build smoke, web build) should remain.

- [ ] **Step 3: Add fixtures fetch step to TS test job**

In `/Users/nuin/Projects/iscn-authenticator/.github/workflows/ci.yml`, find the job that runs `deno test` against `packages/core/tests/`. Before the `deno test` step, add:

```yaml
      - name: Fetch shared fixtures
        working-directory: packages/core
        run: node scripts/fetch-fixtures.mjs
```

- [ ] **Step 4: [VERIFY] YAML is valid**

```bash
python3 -c "import yaml; yaml.safe_load(open('/Users/nuin/Projects/iscn-authenticator/.github/workflows/ci.yml'))" && echo "yaml ok"
```
Expected: `yaml ok`.

- [ ] **Step 5: Commit**

```bash
cd /Users/nuin/Projects/iscn-authenticator
git add .github/workflows/ci.yml
git commit -m "ci: drop python jobs; add fetch-fixtures step to deno tests"
```

### Task 5.3: Delete the Python tree

**Files:** Delete `(monorepo)/iscn_authenticator/`, `(monorepo)/tests/`, `(monorepo)/fixtures/`, `(monorepo)/pyproject.toml`, `(monorepo)/requirements.txt`, `(monorepo)/scripts/verify-pypi-tag.py`, `(monorepo)/scripts/validate_json.py`, `(monorepo)/.github/workflows/publish-pypi.yml`.

- [ ] **Step 1: [VERIFY] No remaining consumers**

Before deleting, confirm one more time that nothing inside `(monorepo)` (other than the files about to be deleted) imports `iscn_authenticator`:

```bash
cd /Users/nuin/Projects/iscn-authenticator
grep -rEn 'from iscn_authenticator|import iscn_authenticator' \
  --include='*.py' --include='*.ts' --include='*.tsx' --include='*.mjs' \
  --exclude-dir='__pycache__' --exclude-dir='iscn_authenticator' --exclude-dir='tests' --exclude-dir='scripts' .
```
Expected: only matches inside `api/server.py` (which is correct — it imports the *published* package now). No matches anywhere else.

- [ ] **Step 2: Delete the directories and files**

```bash
cd /Users/nuin/Projects/iscn-authenticator
git rm -r iscn_authenticator/
git rm -r tests/
git rm -r fixtures/
git rm pyproject.toml
git rm requirements.txt
git rm scripts/verify-pypi-tag.py
git rm scripts/validate_json.py
git rm .github/workflows/publish-pypi.yml
```

- [ ] **Step 3: [VERIFY] Tree is sane**

```bash
git status
ls scripts/      # should still contain other scripts like debug_ast.ts, fetch_cytobands.ts, stress_test.ts, verify_logic.ts
ls .github/workflows/    # should NOT contain publish-pypi.yml; should contain ci.yml, publish-npm.yml, publish-web.yml
```

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove Python library (now lives at github.com/nuin/iscn-authenticator-py)"
```

### Task 5.4: Trim `CHANGELOG.md`

**Files:** Modify `(monorepo)/CHANGELOG.md`.

- [ ] **Step 1: Edit the file**

In `/Users/nuin/Projects/iscn-authenticator/CHANGELOG.md`:

- Remove the entire `## iscn-authenticator (PyPI)` section, including the `### 0.2.0 — 2026-04` block underneath it.
- Keep the `## @iscn/core (npm)` section.
- Update the header line (currently "All notable changes to packages in this monorepo are recorded here") to: `All notable changes to packages in this monorepo are recorded here. For changes to the standalone iscn-authenticator Python package, see https://github.com/nuin/iscn-authenticator-py/blob/master/CHANGELOG.md.`

- [ ] **Step 2: Commit**

```bash
cd /Users/nuin/Projects/iscn-authenticator
git add CHANGELOG.md
git commit -m "docs: split iscn-authenticator (PyPI) changelog out to standalone repo"
```

### Task 5.5: Update root `README.md`

**Files:** Modify `(monorepo)/README.md`.

Three concrete edits.

- [ ] **Step 1: Drop the `iscn_authenticator` row from the Packages table**

In the `## Packages` section's table, delete this row:

```markdown
| `iscn_authenticator` | [`iscn_authenticator/`](iscn_authenticator/) | Python ≥3.10 | Reference implementation, zero runtime deps. |
```

Also update the paragraph above the table — currently it ends with "Nothing here is published — consume from source." Change to:

> This repository is a monorepo containing parallel implementations of the same validation logic, driven by a [fixture corpus](https://github.com/nuin/iscn-authenticator-py/blob/master/fixtures/validity.json) (owned by the standalone Python package) to guarantee behavioural parity. The TypeScript port (`@iscn/core`) consumes the fixtures via a fetch script; the Python reference implementation is published to PyPI as [`iscn-authenticator`](https://pypi.org/project/iscn-authenticator/) from [`nuin/iscn-authenticator-py`](https://github.com/nuin/iscn-authenticator-py).

- [ ] **Step 2: Drop the Python "Use" block**

In the `## Use` section, delete the entire `**Python (from source):**` code block:

````markdown
**Python (from source):**
```bash
git clone https://github.com/nuin/iscn-authenticator
cd iscn-authenticator
pip install .                     # or: pip install -e .
```
```python
from iscn_authenticator import is_valid_karyotype, validate_karyotype

is_valid_karyotype("46,XX")              # True
validate_karyotype("47,XY,+21").errors   # []
```
````

Replace with a single line:

> **Python:** `pip install iscn-authenticator` — see [`nuin/iscn-authenticator-py`](https://github.com/nuin/iscn-authenticator-py) for usage.

- [ ] **Step 3: Drop the "Python tests" Development block**

In the `## Development` section, delete the entire `**Python tests:**` code block:

````markdown
**Python tests:**
```bash
python3 -m unittest discover tests
python3 -m unittest tests.test_fixtures    # cross-implementation fixtures
```
````

These commands now belong in the standalone repo's README, not this one.

- [ ] **Step 4: [VERIFY] No `python -m unittest`, `iscn_authenticator/`, or `pip install .` references remain**

```bash
grep -nE "python -m unittest|iscn_authenticator/|pip install \." /Users/nuin/Projects/iscn-authenticator/README.md
```
Expected: no output. If anything matches, that section also needs removal.

- [ ] **Step 5: Commit**

```bash
cd /Users/nuin/Projects/iscn-authenticator
git add README.md
git commit -m "docs: point monorepo README to standalone Python repo"
```

### Task 5.6: Update `CLAUDE.md` / `AGENTS.md` / `GEMINI.md`

**Files:** Modify `(monorepo)/CLAUDE.md`, `AGENTS.md`, `GEMINI.md`.

- [ ] **Step 1: For each of the three files, remove all Python-library content**

For `CLAUDE.md` and `AGENTS.md`:

- Drop the `iscn_authenticator/` row from the monorepo table.
- Drop the `tests/test_fixtures.py` row from the monorepo table.
- Drop the `python -m unittest …` commands section.
- Drop the Python packaging smoke command section.
- Drop the "Validation pipeline (Python)", "Data model", "Legacy functions" architecture sections — the public-facing reference for those now lives in the standalone repo's docstrings.
- In "TypeScript port" section, remove "When changing validation semantics, update **both** `iscn_authenticator/` and `packages/core/src/`" sentence and replace it with: "The Python reference implementation lives at github.com/nuin/iscn-authenticator-py. When changing validation semantics here, also open a PR in that repo."
- Add a brief "Fetching shared fixtures" subsection under the TS port section: "Run `npm --prefix packages/core run fetch-fixtures` to pull `fixtures/validity.json` from the pinned Python release tag (see `packages/core/package.json` → `iscn.fixturesTag`)."

For `GEMINI.md`: similarly remove Python sections.

- [ ] **Step 2: [VERIFY] No stale Python references remain**

```bash
cd /Users/nuin/Projects/iscn-authenticator
grep -nE "iscn_authenticator/|python -m unittest|hatchling" CLAUDE.md AGENTS.md GEMINI.md | head -10
```
Expected: no output (or only matches in fenced examples that document the external repo).

- [ ] **Step 3: Commit**

```bash
cd /Users/nuin/Projects/iscn-authenticator
git add CLAUDE.md AGENTS.md GEMINI.md
git commit -m "docs: drop Python sections from agent context files"
```

### Task 5.7: Local CI dry-run before pushing the PR

**Files:** none (verification).

- [ ] **Step 1: Run the TS test suite end-to-end**

```bash
cd /Users/nuin/Projects/iscn-authenticator/packages/core
rm -rf tests/fixtures
node scripts/fetch-fixtures.mjs
deno test --allow-read --unstable-sloppy-imports tests/
```
Expected: PASS.

- [ ] **Step 2: Verify api/ builds against the published package**

```bash
python3 -m venv /tmp/iscn-pr-smoke
/tmp/iscn-pr-smoke/bin/pip install --quiet -r /Users/nuin/Projects/iscn-authenticator/api/requirements.txt
/tmp/iscn-pr-smoke/bin/python -c "
import sys
sys.path.insert(0, '/Users/nuin/Projects/iscn-authenticator')
from api.server import validate_karyotype
print(validate_karyotype('46,XX').valid)
"
rm -rf /tmp/iscn-pr-smoke
```
Expected: `True`.

- [ ] **Step 3: Run Deno tasks**

```bash
cd /Users/nuin/Projects/iscn-authenticator/deno
deno task check
```
Expected: PASS.

- [ ] **Step 4: Run the rest of the Deno test suite**

```bash
cd /Users/nuin/Projects/iscn-authenticator/deno
deno task test
```
Expected: all tests pass.

### Task 5.8: Push the branch and open the PR

**Files:** none.

- [ ] **Step 1: Push the branch**

```bash
cd /Users/nuin/Projects/iscn-authenticator
git push -u origin extract-python-library-cutover
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --base master --head extract-python-library-cutover \
  --title "Extract iscn-authenticator Python library to standalone repo" \
  --body "$(cat <<'EOF'
## Summary

- Remove the Python `iscn_authenticator/` library from this monorepo. It now lives at https://github.com/nuin/iscn-authenticator-py and is published as `iscn-authenticator>=0.2.0` on PyPI.
- Switch `api/` to depend on the published package.
- The TS port's parity test fetches `fixtures/validity.json` from the new repo at a pinned tag (`v0.2.0-py`).

Spec: `docs/superpowers/specs/2026-05-31-extract-iscn-authenticator-design.md`.
Plan: `docs/superpowers/plans/2026-05-31-extract-iscn-authenticator.md`.

## Deletions
- `iscn_authenticator/` (entire tree)
- `tests/` (entire tree)
- `fixtures/`
- top-level `pyproject.toml`, `requirements.txt`
- `scripts/verify-pypi-tag.py`, `scripts/validate_json.py`
- `.github/workflows/publish-pypi.yml`

## Test plan

- [ ] CI passes on this PR (Deno test, Node build smoke, web build).
- [ ] `api/` resolves `iscn-authenticator>=0.2.0` and imports the new dep.
- [ ] `packages/core` `npm run fetch-fixtures` succeeds; `deno test` passes.
- [ ] After merge, in a clean venv: `pip install iscn-authenticator==0.2.0`, run sample karyotypes against `validate_karyotype`.
EOF
)"
```

- [ ] **Step 3: [VERIFY] CI on the PR passes**

```bash
gh pr checks --watch
```
Expected: all checks pass. If anything fails:

- **TS fixture parity fails:** the fetch step or the test path update has a bug. Fix and push to the branch.
- **api/ install fails:** PyPI propagation lag — retry the failing job.
- **YAML/lint:** fix and push.

### Task 5.9: Merge the PR

**Files:** none.

- [ ] **Step 1: `[USER]` Confirm and merge**

Pause for user confirmation: "PR `extract-python-library-cutover` is green and ready to merge. Confirm to proceed."

```bash
cd /Users/nuin/Projects/iscn-authenticator
gh pr merge extract-python-library-cutover --merge --delete-branch
```

- [ ] **Step 2: Pull master and clean up local branch**

```bash
git checkout master
git pull origin master
git branch -D extract-python-library-cutover 2>/dev/null || true
```

---

# Phase 6 — Post-merge verification

Goal: confirm the post-extraction world works end-to-end.

### Task 6.1: Clean-room PyPI install

**Files:** none.

- [ ] **Step 1: Install from PyPI in a throwaway venv**

```bash
python3 -m venv /tmp/iscn-final-smoke
/tmp/iscn-final-smoke/bin/pip install iscn-authenticator==0.2.0
/tmp/iscn-final-smoke/bin/python -c "
from iscn_authenticator import is_valid_karyotype
from iscn_authenticator.main import validate_karyotype

cases = [
    ('46,XX', True),
    ('47,XY,+21', True),
    ('46,XX,t(9;22)(q34;q11.2)', True),
    ('46,XX,del(5)(q13q33)', True),
    ('47,XY,+21[8]/46,XY[12]', True),
    ('45,X', True),
    ('garbage', False),
]
for k, expected in cases:
    actual = is_valid_karyotype(k)
    assert actual == expected, f'{k}: expected {expected}, got {actual}'
print('all', len(cases), 'cases ok')
"
rm -rf /tmp/iscn-final-smoke
```
Expected: `all 7 cases ok`.

### Task 6.2: Verify the monorepo `api/` still serves requests

**Files:** none.

- [ ] **Step 1: Install and start the API**

```bash
cd /Users/nuin/Projects/iscn-authenticator
python3 -m venv /tmp/iscn-api-final
/tmp/iscn-api-final/bin/pip install --quiet -r api/requirements.txt
/tmp/iscn-api-final/bin/uvicorn api.server:app --port 8765 &
SERVER_PID=$!
sleep 2
```

- [ ] **Step 2: Hit the /validate endpoint**

```bash
curl -fsS -X POST http://localhost:8765/validate \
  -H "Content-Type: application/json" \
  -d '{"karyotype": "46,XX"}'
```
Expected: JSON response with `"valid": true`.

- [ ] **Step 3: Tear down**

```bash
kill $SERVER_PID
rm -rf /tmp/iscn-api-final
```

### Task 6.3: Final check — both repos' CI clean

**Files:** none.

- [ ] **Step 1: Monorepo CI (post-merge run on master)**

```bash
gh run list --repo nuin/iscn-authenticator --limit 1
```
Expected: most recent CI on master is `success`.

- [ ] **Step 2: New repo CI**

```bash
gh run list --repo nuin/iscn-authenticator-py --limit 3
```
Expected: most recent CI + publish workflow are `success`.

---

# Done

After Phase 6, the extraction is complete:

- `iscn-authenticator==0.2.0` is on PyPI and installable.
- The new repo at `github.com/nuin/iscn-authenticator-py` is the canonical home for the Python library, with ruff, pre-commit, and a CI that runs across Python 3.10–3.13.
- The monorepo no longer contains any Python validation code; `api/` depends on the published package.
- The TS port's parity test fetches the corpus from the new repo's `v0.2.0-py` tag.

Further work (explicitly out of scope, listed for future sessions):

- Add CITATION.cff / Zenodo integration in the new repo.
- Add Dependabot / Renovate config in the new repo.
- Add new repo's `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` once enough non-obvious context accumulates.
- Re-create `scripts/validate_json.py` in the monorepo as a tiny CLI on top of `pip install iscn-authenticator`.
- Move to `uv` if/when the user wants to.
