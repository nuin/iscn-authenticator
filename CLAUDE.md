# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ISCN Authenticator validates ISCN (International System for Human Cytogenomic Nomenclature, 2024) karyotype strings. It exists in three parallel forms that must be kept in sync:

1. **Python library** (`iscn_authenticator/`) — reference implementation, no runtime dependencies
2. **FastAPI server** (`api/`) — wraps the Python library as an HTTP API
3. **Deno/TypeScript port** (`deno/`) — native TS reimplementation for Deno Deploy (no Python on the edge)

## Commands

**Python tests** (from project root):
```bash
python -m unittest discover tests                              # run all tests
python -m unittest tests.test_parser                           # one test file
python -m unittest tests.test_main.TestIsValidKaryotype.test_valid_karyotypes  # one test
```

**FastAPI server:**
```bash
uvicorn api.server:app --reload     # dev
python api/server.py                 # prod-like (reads $PORT, default 8000)
```

**Deno (from `deno/` directory):**
```bash
deno task serve    # run server.ts (reads static/ from disk)
deno task dev      # serve with --watch
deno task cli "46,XX"              # CLI validator
deno task cli "47,XY,+21" --json
deno task check    # type-check all .ts
deno task fmt
deno task lint
```

Note: `deno/main.ts` is the **Deno Deploy** entrypoint — it embeds the HTML inline and uses `validateKaryotypeNative` (no subprocess), while `deno/server.ts` is for local dev and serves files from `deno/static/`. The top-level `deno.json` points Deploy to `deno/main.ts`; the inner `deno/deno.json` defines tasks.

## Architecture

### Validation pipeline (Python)

`validate_karyotype()` in `iscn_authenticator/main.py` is the single entry point. It wires together:

1. **`KaryotypeParser`** (`parser.py`) — string → `KaryotypeAST`. Raises `ParseError` on malformed syntax. Each abnormality type has its own regex + parse method; `_parse_abnormalities` dispatches by prefix. **Dispatch order matters**: `idic(` must be checked before `i(`, `dic(` before `der(`, `rob(` before `r(`, `ins(` before `i(`, `trp(` before `t(` — otherwise shorter prefixes shadow longer ones.
2. **`RuleEngine`** (`engine.py`) — runs two rule sets against the AST:
   - AST-level rules (`ALL_CHROMOSOME_RULES`) — run once per karyotype
   - Abnormality-level rules (`ALL_ABNORMALITY_RULES`) — run once per `Abnormality`
3. **`ValidationResult`** (`models.py`) — `{ valid, errors, parsed }`.

Adding a new rule: define a `validate(ast, target) -> list[str]` function, wrap in `Rule(...)`, and append to the list in `rules/chromosome.py` or `rules/abnormality.py`. Rules return strings (one per error); empty list means pass.

Adding a new abnormality type: add a regex constant + `_parse_X` method in `KaryotypeParser`, add a dispatch branch in `_parse_abnormalities` (mind prefix ordering above), and extend the relevant dataclass fields in `models.py` if needed.

### Data model

`KaryotypeAST` carries `chromosome_count` (int or `"45~48"` range string), `sex_chromosomes` (e.g., `"XX"`, `"XY"`, `"U"` for undisclosed), `abnormalities`, optional `cell_lines` (for mosaics, split on `/`), and `modifiers`. `Abnormality.raw` always preserves the original substring including uncertainty `?` and inheritance suffixes (`mat`/`pat`/`dn`), which are stripped into separate fields before regex matching.

### Legacy functions

`main.py` still exports `_validate_total_chromosome_number`, `_validate_sex_chromosomes`, `_validate_coherence`, `_validate_abnormalities`, and `_validate_deletion_content`. These are **legacy shims** kept for backward compatibility with older tests — new logic belongs in rules, not here.

### TypeScript port

`deno/lib/` mirrors the Python structure: `parser.ts`, `engine.ts`, `validator.ts`, `types.ts`, `rules/chromosome.ts`, `rules/abnormality.ts`. `validate.ts` exposes `validateKaryotypeNative` used by the Deploy entrypoint. When changing validation semantics, update both `iscn_authenticator/` and `deno/lib/` — the test suites are independent and drift is easy.

## ISCN Reference

`iscn_2024.txt` (extracted from the PDF of the same name in the project root) is the authoritative nomenclature spec. Consult it before extending grammar coverage. `docs/plans/` contains design documents for the validation engine.
