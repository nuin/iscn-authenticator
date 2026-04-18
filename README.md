# ISCN Authenticator

Validates ISCN 2024 (International System for Human Cytogenomic Nomenclature) karyotype strings.

## Packages

This repository is a monorepo containing parallel implementations of the same validation logic, driven by a [shared fixture corpus](fixtures/validity.json) to guarantee behavioural parity.

| Package | Location | Runtime | Purpose |
|---|---|---|---|
| `iscn-authenticator` | [`iscn_authenticator/`](iscn_authenticator/) | Python ≥3.10 | Reference implementation. Published to PyPI. |
| `@iscn/core` | [`packages/core/`](packages/core/) | Node ≥18 / Deno | TypeScript port. Published to npm. |
| ISCN API | [`api/`](api/) | Python (FastAPI) | HTTP wrapper around the Python library. |
| Deno app | [`deno/`](deno/) | Deno Deploy | Web UI + HTTP API; imports `@iscn/core` directly. |

## Install

**Python:**
```bash
pip install iscn-authenticator
```
```python
from iscn_authenticator import is_valid_karyotype, validate_karyotype

is_valid_karyotype("46,XX")              # True
validate_karyotype("47,XY,+21").errors   # []
```

**JavaScript / TypeScript (Node):**
```bash
npm install @iscn/core
```
```typescript
import { isValidKaryotypeNative, validateKaryotypeNative } from "@iscn/core";

isValidKaryotypeNative("46,XX");              // true
validateKaryotypeNative("47,XY,+21").errors;  // []
```

**Deno:**
```typescript
import { isValidKaryotypeNative } from "jsr:@iscn/core";
// or import directly from packages/core/src/index.ts inside this repo
```

## Development

**Python tests:**
```bash
python -m unittest discover tests
python -m unittest tests.test_fixtures    # cross-implementation fixtures
```

**TypeScript tests (Deno):**
```bash
cd packages/core
deno test --allow-read --unstable-sloppy-imports tests/
```

**TypeScript build (Node):**
```bash
cd packages/core
npm install
npm run build
```

**Deno web app (local dev):**
```bash
cd deno
deno task dev
```

## Architecture

`validate_karyotype()` is the single entry point in both implementations. The pipeline is:

1. **Parser** — string → `KaryotypeAST`. Raises on malformed syntax.
2. **Rule engine** — runs AST-level rules (chromosome count, sex chromosomes) + per-abnormality rules.
3. **Result** — `{ valid, errors, parsed }`.

See [CLAUDE.md](CLAUDE.md) for deeper architecture notes, and [`iscn_2024.txt`](iscn_2024.txt) for the authoritative nomenclature spec.

## License

MIT
