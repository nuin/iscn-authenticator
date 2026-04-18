# ISCN Authenticator

Validates ISCN 2024 (International System for Human Cytogenomic Nomenclature) karyotype strings.

## Packages

This repository is a monorepo containing parallel implementations of the same validation logic, driven by a [shared fixture corpus](fixtures/validity.json) to guarantee behavioural parity. Nothing here is published — consume from source.

| Component | Location | Runtime | Purpose |
|---|---|---|---|
| `iscn_authenticator` | [`iscn_authenticator/`](iscn_authenticator/) | Python ≥3.10 | Reference implementation, zero runtime deps. |
| `@iscn/core` | [`packages/core/`](packages/core/) | Node ≥18 / Deno | TypeScript port, zero runtime deps. |
| ISCN API | [`api/`](api/) | Python (FastAPI) | HTTP wrapper around the Python library. |
| Deno app | [`deno/`](deno/) | Deno Deploy | Web UI + HTTP API; imports core from `packages/core/src/`. |

## Use

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

**TypeScript (Node, from source):**
```bash
cd packages/core
npm install
npm run build                     # emits dist/
```
```typescript
import { isValidKaryotypeNative, validateKaryotypeNative } from "./packages/core/dist/index.js";

isValidKaryotypeNative("46,XX");              // true
validateKaryotypeNative("47,XY,+21").errors;  // []
```

**Deno (from source):**
```typescript
import { isValidKaryotypeNative } from "./packages/core/src/index.ts";
// Requires "unstable": ["sloppy-imports"] in deno.json (already configured at repo root).
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
