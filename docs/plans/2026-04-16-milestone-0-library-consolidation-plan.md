# Milestone 0 — Library Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the pure-TypeScript ISCN validation core from `deno/lib/` into a standalone `@iscn/core` npm package, create a shared test fixture corpus that both Python and TypeScript runners consume identically, and publish both packages (npm + PyPI) with CI that guards cross-implementation drift.

**Architecture:** Monorepo with `packages/core/` (TS, published as `@iscn/core`) holding pure validation code. Existing `iscn_authenticator/` (Python) stays in place, gets a `pyproject.toml` for PyPI publishing. Shared `fixtures/validity.json` is the single source of truth for correctness. GitHub Actions CI runs both runners against the corpus on every PR.

**Tech Stack:** TypeScript (tsc for build), Deno (test runner for TS, existing tooling), Python unittest, GitHub Actions, npm, PyPI.

---

## Spec Reference

This plan implements **Milestone 0** from `docs/plans/2026-04-16-monetization-v1-design.md`. Gate criterion from the spec: *"both packages install and validate the shared corpus identically."*

## File Structure After This Plan

```
/
├── packages/
│   └── core/
│       ├── src/
│       │   ├── index.ts              (re-exports public API)
│       │   ├── types.ts              (moved from deno/lib/)
│       │   ├── parser.ts             (moved from deno/lib/)
│       │   ├── engine.ts             (moved from deno/lib/)
│       │   ├── validate.ts           (moved from deno/lib/)
│       │   └── rules/
│       │       ├── chromosome.ts     (moved from deno/lib/rules/)
│       │       └── abnormality.ts    (moved from deno/lib/rules/)
│       ├── tests/
│       │   └── fixtures.test.ts      (new, fixture-driven tests)
│       ├── package.json              (new)
│       ├── tsconfig.json             (new)
│       ├── README.md                 (new)
│       └── .npmignore                (new)
├── fixtures/
│   ├── validity.json                 (new, shared corpus)
│   └── README.md                     (new)
├── iscn_authenticator/               (existing Python package, unchanged)
├── tests/
│   ├── test_fixtures.py              (new, fixture-driven Python test)
│   └── ... (existing tests unchanged)
├── deno/
│   ├── lib/
│   │   └── validator.ts              (kept - app-specific multi-mode orchestrator)
│   ├── main.ts                       (imports updated)
│   ├── server.ts                     (imports updated)
│   └── cli.ts                        (imports updated)
├── pyproject.toml                    (new, top-level for iscn_authenticator)
├── .github/
│   └── workflows/
│       └── ci.yml                    (new)
├── deno.json                         (existing root)
└── README.md                         (existing)
```

---

## Pre-flight Checks

- [ ] **Verify clean working tree before starting**

```bash
cd /Users/nuin/Projects/iscn-authenticator
git status
```

Expected: `nothing to commit, working tree clean` on branch `master` (or a feature branch).

- [ ] **Create a feature branch**

```bash
git checkout -b milestone-0-library-consolidation
```

Expected: `Switched to a new branch 'milestone-0-library-consolidation'`

- [ ] **Verify Python tests currently pass**

```bash
python -m unittest discover tests/ -v 2>&1 | tail -5
```

Expected: `OK` at the bottom. If this fails, stop and fix before proceeding.

- [ ] **Verify Deno is installed**

```bash
deno --version
```

Expected: Deno 1.x or 2.x version string.

---

## Task 1: Create monorepo directory scaffolding

**Files:**
- Create: `packages/core/src/` (directory)
- Create: `packages/core/tests/` (directory)
- Create: `fixtures/` (directory)

- [ ] **Step 1: Create directories**

```bash
mkdir -p packages/core/src/rules packages/core/tests fixtures
```

- [ ] **Step 2: Verify structure**

```bash
ls -la packages/core/ fixtures/
```

Expected: Both directories exist.

- [ ] **Step 3: Commit the scaffolding**

```bash
git add packages/ fixtures/ 2>/dev/null || true
# nothing to add yet - directories are empty. Add .gitkeep placeholders.
touch packages/core/src/.gitkeep packages/core/tests/.gitkeep fixtures/.gitkeep
git add packages/ fixtures/
git commit -m "scaffold: add packages/core and fixtures directories"
```

---

## Task 2: Create shared validity fixture corpus

**Rationale:** Create fixtures *first* so both runners have a target to consume. The fixture format is the contract.

**Files:**
- Create: `fixtures/validity.json`
- Create: `fixtures/README.md`

- [ ] **Step 1: Write the fixture file**

Create `fixtures/validity.json`:

```json
{
  "$schema_version": 1,
  "description": "Shared ISCN karyotype validity corpus. Both Python (iscn_authenticator) and TypeScript (@iscn/core) runners consume this file. Any change here must pass in both runners.",
  "valid": [
    { "input": "46,XX", "note": "normal female" },
    { "input": "46,XY", "note": "normal male" },
    { "input": "47,XXX", "note": "triple X" },
    { "input": "47,XXY", "note": "Klinefelter" },
    { "input": "47,XYY", "note": "Jacobs" },
    { "input": "45,X", "note": "Turner" },
    { "input": "47,XY,+21", "note": "Down" },
    { "input": "47,XX,+13", "note": "Patau" },
    { "input": "47,XY,+18", "note": "Edwards" },
    { "input": "46,XX,del(5)(q13q33)", "note": "5q- interstitial deletion" },
    { "input": "46,XY,del(7)(q22q36)", "note": "7q deletion" },
    { "input": "46,XX,t(9;22)(q34;q11.2)", "note": "CML Philadelphia" },
    { "input": "46,XY,t(8;14)(q24;q32)", "note": "Burkitt" },
    { "input": "46,XX,t(15;17)(q24;q21)", "note": "APL" },
    { "input": "46,XY,inv(3)(q21q26)", "note": "inversion with two breakpoints" },
    { "input": "46,XX,+mar", "note": "marker chromosome" },
    { "input": "46,XY,der(1)t(1;3)(p36;q21)", "note": "derivative" }
  ],
  "invalid": [
    { "input": "", "reason": "empty string" },
    { "input": "46", "reason": "missing sex chromosomes" },
    { "input": "46,XX,XY", "reason": "extra sex notation" },
    { "input": "47,XX", "reason": "chromosome count 47 with only 2 sex chromosomes" },
    { "input": "46,XX,del(5)", "reason": "del missing breakpoint specification" },
    { "input": "46,XX,t(9;22)", "reason": "translocation missing breakpoints" },
    { "input": "99,XX", "reason": "chromosome count out of range" },
    { "input": "abc,XX", "reason": "non-numeric chromosome count" }
  ]
}
```

- [ ] **Step 2: Write fixtures README**

Create `fixtures/README.md`:

```markdown
# Shared Test Fixtures

This directory holds test fixtures consumed by both the Python (`iscn_authenticator`)
and TypeScript (`@iscn/core`) implementations. The fixtures are the single source of
truth for cross-implementation correctness.

## Files

- `validity.json` — Pairs of karyotype strings and their expected validity
  (`valid` or `invalid`). Used by fixture-driven tests in both runners.

## Contract

If you change `validity.json`:

1. Run `python -m unittest tests.test_fixtures -v` — must pass.
2. Run `cd packages/core && deno test` — must pass.
3. CI runs both and will fail the PR if either disagrees.

## Adding cases

Add to `valid[]` or `invalid[]`. Each entry is `{ "input": "...", "note"|"reason": "..." }`.
Keep entries short; they run in CI on every PR.

## Out of scope for this fixture file

- Parse AST structure comparisons (future fixture file if needed)
- Error message text comparisons (error messages are implementation-specific)
- Performance benchmarks
```

- [ ] **Step 3: Commit**

```bash
git add fixtures/
git commit -m "add shared validity fixture corpus"
```

---

## Task 3: Write Python fixture-driven test

**Rationale:** Python library already works. Prove the fixture contract by writing a Python runner against it — this should pass immediately.

**Files:**
- Create: `tests/test_fixtures.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_fixtures.py`:

```python
"""Fixture-driven cross-implementation consistency tests.

Reads fixtures/validity.json and asserts that iscn_authenticator agrees with
each case. A parallel TypeScript runner (packages/core/tests/fixtures.test.ts)
reads the same file. CI runs both.
"""

import json
import pathlib
import unittest

from iscn_authenticator.main import is_valid_karyotype

FIXTURES_PATH = pathlib.Path(__file__).resolve().parent.parent / "fixtures" / "validity.json"


class TestValidityFixtures(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with FIXTURES_PATH.open() as f:
            cls.fixtures = json.load(f)

    def test_valid_cases_all_pass(self):
        for case in self.fixtures["valid"]:
            with self.subTest(input=case["input"], note=case.get("note", "")):
                self.assertTrue(
                    is_valid_karyotype(case["input"]),
                    f"expected valid: {case['input']!r} ({case.get('note', '')})",
                )

    def test_invalid_cases_all_fail(self):
        for case in self.fixtures["invalid"]:
            with self.subTest(input=case["input"], reason=case.get("reason", "")):
                self.assertFalse(
                    is_valid_karyotype(case["input"]),
                    f"expected invalid: {case['input']!r} ({case.get('reason', '')})",
                )


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test**

```bash
python -m unittest tests.test_fixtures -v
```

Expected: All subtests pass, final line `OK`.

If any fail: the fixture case is wrong OR the Python library has a bug. Investigate before proceeding. Do not weaken the fixture to make tests pass; either fix the library or remove a genuinely-ambiguous case from the corpus.

- [ ] **Step 3: Commit**

```bash
git add tests/test_fixtures.py
git commit -m "add Python fixture-driven validity tests"
```

---

## Task 4: Move pure-TS core files to packages/core/src/

**Files:**
- Move: `deno/lib/types.ts` → `packages/core/src/types.ts`
- Move: `deno/lib/parser.ts` → `packages/core/src/parser.ts`
- Move: `deno/lib/engine.ts` → `packages/core/src/engine.ts`
- Move: `deno/lib/validate.ts` → `packages/core/src/validate.ts`
- Move: `deno/lib/rules/chromosome.ts` → `packages/core/src/rules/chromosome.ts`
- Move: `deno/lib/rules/abnormality.ts` → `packages/core/src/rules/abnormality.ts`
- Delete: `packages/core/src/.gitkeep` (no longer needed)

Note: `deno/lib/validator.ts` stays. It contains Deno-specific multi-mode orchestration (HTTP → native → Python subprocess) which is application code, not library code.

- [ ] **Step 1: Move files using git mv (preserves history)**

```bash
cd /Users/nuin/Projects/iscn-authenticator
git mv deno/lib/types.ts packages/core/src/types.ts
git mv deno/lib/parser.ts packages/core/src/parser.ts
git mv deno/lib/engine.ts packages/core/src/engine.ts
git mv deno/lib/validate.ts packages/core/src/validate.ts
git mv deno/lib/rules/chromosome.ts packages/core/src/rules/chromosome.ts
git mv deno/lib/rules/abnormality.ts packages/core/src/rules/abnormality.ts
rm packages/core/src/.gitkeep
```

- [ ] **Step 2: Verify files moved**

```bash
ls packages/core/src/ packages/core/src/rules/
ls deno/lib/
```

Expected: `packages/core/src/` contains `types.ts parser.ts engine.ts validate.ts rules/`. `deno/lib/` contains only `validator.ts`.

- [ ] **Step 3: Do NOT commit yet** — imports inside the moved files may reference each other with relative paths, and `deno/lib/validator.ts` still imports from the old locations. Proceed directly to Task 5.

---

## Task 5: Fix imports inside the moved core files

**Rationale:** Intra-core imports (e.g., `parser.ts` importing from `./types.ts`) use relative paths that should still work after the move. Verify this and fix only broken ones.

**Files:**
- Verify/modify: `packages/core/src/parser.ts`
- Verify/modify: `packages/core/src/engine.ts`
- Verify/modify: `packages/core/src/validate.ts`
- Verify/modify: `packages/core/src/rules/chromosome.ts`
- Verify/modify: `packages/core/src/rules/abnormality.ts`

- [ ] **Step 1: Audit all imports in moved files**

```bash
grep -n "^import" packages/core/src/*.ts packages/core/src/rules/*.ts
```

Expected: All imports should be relative (`./` or `../`), none should reference `../../deno/` or absolute paths.

If any import references something outside `packages/core/src/`, flag it. The only legitimate external references from core should be to other core files (which should still resolve after the move, since we moved the whole tree together).

- [ ] **Step 2: Run type check on core**

```bash
cd packages/core && deno check src/validate.ts && cd ../..
```

Expected: No type errors. If errors about missing imports, fix them to point to the correct relative paths within `packages/core/src/`.

- [ ] **Step 3: Do NOT commit yet** — proceed to Task 6 to fix the Deno app imports.

---

## Task 6: Update Deno app imports to point to new core location

**Files:**
- Modify: `deno/main.ts:8`
- Modify: `deno/cli.ts:12-13`
- Modify: `deno/server.ts:13`
- Modify: `deno/lib/validator.ts` (imports from moved core)

- [ ] **Step 1: Update `deno/main.ts`**

Change line 8 from:
```typescript
import { validateKaryotypeNative } from "./lib/validate.ts";
```
to:
```typescript
import { validateKaryotypeNative } from "../packages/core/src/validate.ts";
```

- [ ] **Step 2: Update `deno/cli.ts`**

Change lines 12-13 from:
```typescript
import { validateKaryotype } from "./lib/validator.ts";
import type { ValidationResult, Abnormality } from "./lib/types.ts";
```
to:
```typescript
import { validateKaryotype } from "./lib/validator.ts";
import type { ValidationResult, Abnormality } from "../packages/core/src/types.ts";
```

Only the second line changes; `validator.ts` stays in `deno/lib/`.

- [ ] **Step 3: Update `deno/server.ts`**

Line 13 does not change (it imports from `./lib/validator.ts`, which stays). Verify:

```bash
grep "^import" deno/server.ts
```

Expected: imports from `./lib/validator.ts` (unchanged).

- [ ] **Step 4: Update `deno/lib/validator.ts`**

Audit its imports:

```bash
grep "^import" deno/lib/validator.ts
```

Any import referencing `./types.ts`, `./parser.ts`, `./engine.ts`, `./validate.ts`, or `./rules/...` needs the path prefix changed from `./` to `../../packages/core/src/`.

Example: if the file has `import type { ValidationResult } from "./types.ts";`, change to `import type { ValidationResult } from "../../packages/core/src/types.ts";`.

- [ ] **Step 5: Type-check the whole Deno app**

```bash
cd deno && deno check main.ts server.ts cli.ts lib/validator.ts && cd ..
```

Expected: No type errors across all four files.

- [ ] **Step 6: Smoke-test the Deno CLI still works**

```bash
deno run --allow-read deno/cli.ts "46,XX"
```

Expected: Valid output (success message for normal female karyotype).

```bash
deno run --allow-read deno/cli.ts "46,XX,del(5)(q13q33)"
```

Expected: Valid output.

- [ ] **Step 7: Commit the move + import updates as one atomic change**

```bash
git add deno/ packages/
git commit -m "extract TS core into packages/core; update Deno app imports"
```

---

## Task 7: Create packages/core/src/index.ts (public API surface)

**Rationale:** Define the public API explicitly rather than letting consumers deep-import. This is what gets published to npm.

**Files:**
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Write the index**

Create `packages/core/src/index.ts`:

```typescript
/**
 * @iscn/core — ISCN 2024 karyotype validation
 *
 * Public API. Consumers should import from here, not from deep paths.
 */

// Validation entry points
export {
  validateKaryotypeNative,
  isValidKaryotypeNative,
} from "./validate.ts";

// AST + result types
export type {
  Abnormality,
  Breakpoint,
  CellLine,
  KaryotypeAST,
  Modifiers,
  Rule,
  ValidationResult,
} from "./types.ts";

// Parser + engine (advanced / tool consumers)
export { KaryotypeParser, ParseError } from "./parser.ts";
export { RuleEngine } from "./engine.ts";

// Rule sets (consumers building custom rule stacks)
export { ALL_CHROMOSOME_RULES } from "./rules/chromosome.ts";
export { ALL_ABNORMALITY_RULES } from "./rules/abnormality.ts";
```

- [ ] **Step 2: Type-check the index**

```bash
cd packages/core && deno check src/index.ts && cd ../..
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "define @iscn/core public API surface"
```

---

## Task 8: Write TypeScript fixture-driven test

**Files:**
- Create: `packages/core/tests/fixtures.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/core/tests/fixtures.test.ts`:

```typescript
/**
 * Fixture-driven cross-implementation consistency tests.
 *
 * Reads fixtures/validity.json (shared with the Python runner) and asserts
 * that @iscn/core agrees with each case. CI runs both runners; any
 * disagreement fails the build.
 */

import { assert, assertFalse } from "jsr:@std/assert@1";
import { isValidKaryotypeNative } from "../src/validate.ts";

interface ValidCase {
  input: string;
  note?: string;
}

interface InvalidCase {
  input: string;
  reason?: string;
}

interface Fixtures {
  $schema_version: number;
  valid: ValidCase[];
  invalid: InvalidCase[];
}

const fixturesUrl = new URL("../../../fixtures/validity.json", import.meta.url);
const fixtures: Fixtures = JSON.parse(await Deno.readTextFile(fixturesUrl));

Deno.test("all valid fixtures pass validation", () => {
  const failures: string[] = [];
  for (const c of fixtures.valid) {
    if (!isValidKaryotypeNative(c.input)) {
      failures.push(`expected valid: ${JSON.stringify(c.input)} (${c.note ?? ""})`);
    }
  }
  assert(
    failures.length === 0,
    `${failures.length} valid fixtures failed:\n${failures.join("\n")}`,
  );
});

Deno.test("all invalid fixtures fail validation", () => {
  const failures: string[] = [];
  for (const c of fixtures.invalid) {
    if (isValidKaryotypeNative(c.input)) {
      failures.push(`expected invalid: ${JSON.stringify(c.input)} (${c.reason ?? ""})`);
    }
  }
  assertFalse(
    failures.length > 0,
    `${failures.length} invalid fixtures unexpectedly passed:\n${failures.join("\n")}`,
  );
});
```

- [ ] **Step 2: Run the test**

```bash
cd packages/core && deno test --allow-read tests/fixtures.test.ts && cd ../..
```

Expected: Both tests pass, `ok | 2 passed | 0 failed`.

If failures: either the TS implementation disagrees with Python on a case, or the fixture is ambiguous. Investigate — do not silently relax.

- [ ] **Step 3: Commit**

```bash
git add packages/core/tests/fixtures.test.ts
git commit -m "add TypeScript fixture-driven validity tests"
```

---

## Task 9: Create packages/core/package.json and tsconfig.json for npm publishing

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/.npmignore`
- Create: `packages/core/README.md`

- [ ] **Step 1: Write `package.json`**

Create `packages/core/package.json`:

```json
{
  "name": "@iscn/core",
  "version": "0.1.0",
  "description": "ISCN 2024 karyotype validation — parser, rule engine, and types. Pure TypeScript, zero runtime dependencies.",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": [
    "dist/",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "build": "tsc",
    "test": "deno test --allow-read tests/fixtures.test.ts",
    "prepublishOnly": "npm run build && npm test"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/nuin/iscn-authenticator.git",
    "directory": "packages/core"
  },
  "keywords": ["iscn", "karyotype", "cytogenetics", "bioinformatics", "validation"],
  "engines": {
    "node": ">=18"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

Create `packages/core/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Note on `allowImportingTsExtensions: false`:** Deno uses `.ts` extensions in imports (e.g., `from "./types.ts"`). tsc with `moduleResolution: bundler` will reject these by default. The fix is applied in Task 10.

- [ ] **Step 3: Write `.npmignore`**

Create `packages/core/.npmignore`:

```
src/
tests/
tsconfig.json
.gitkeep
*.test.ts
```

- [ ] **Step 4: Write `README.md`**

Create `packages/core/README.md`:

````markdown
# @iscn/core

ISCN 2024 karyotype validation. Pure TypeScript, zero runtime dependencies.

## Install

```bash
npm install @iscn/core
```

## Use

```typescript
import { validateKaryotypeNative, isValidKaryotypeNative } from "@iscn/core";

isValidKaryotypeNative("46,XX,del(5)(q13q33)"); // true
validateKaryotypeNative("46,XX,del(5)");        // { valid: false, errors: [...] }
```

## License

MIT. See `LICENSE` in the repository root.

## Related

- Python package: `iscn-authenticator` on PyPI
- Shared test corpus: `fixtures/validity.json` in the source repo
````

- [ ] **Step 5: Do NOT build or commit yet** — Task 10 fixes the `.ts` extension issue in source imports.

---

## Task 10: Adjust imports for Deno + tsc dual compatibility

**Rationale:** The source files currently use `.ts` extensions in imports (Deno convention). For tsc to emit publishable Node output, we adopt the Node convention: source imports use `.js` extensions that resolve to the emitted files. Deno's `unstable-sloppy-imports` lets Deno resolve those same `.js` specifiers back to the `.ts` source. One source tree, two runtimes.

**Files:**
- Modify: every `*.ts` in `packages/core/src/` that has intra-package imports
- Create: `packages/core/deno.json`
- (Task 9's `tsconfig.json` is already correct — no change needed in this task)

- [ ] **Step 1: List every intra-package import that uses `.ts` extensions**

```bash
grep -rn 'from "\./[^"]*\.ts"\|from "\.\./[^"]*\.ts"' packages/core/src/
```

Expected: a list of lines like `packages/core/src/parser.ts:3:import type { KaryotypeAST } from "./types.ts";`. Note every file/line.

- [ ] **Step 2: Rewrite `.ts` → `.js` in each of those imports**

For each match from Step 1, change the trailing `.ts"` to `.js"`. Example:

```typescript
// before
import type { KaryotypeAST } from "./types.ts";
// after
import type { KaryotypeAST } from "./types.js";
```

Do this for every intra-package import in `packages/core/src/` (including files in `src/rules/`). Do NOT touch `packages/core/src/index.ts` yet — apply the same rewrite there as well so all public re-exports end in `.js`.

- [ ] **Step 3: Verify the rewrite is complete**

```bash
grep -rn 'from "\./[^"]*\.ts"\|from "\.\./[^"]*\.ts"' packages/core/src/
```

Expected: no matches (empty output).

- [ ] **Step 4: Create `packages/core/deno.json` so Deno still resolves the sources**

Create `packages/core/deno.json`:

```json
{
  "unstable": ["sloppy-imports"],
  "tasks": {
    "test": "deno test --allow-read --unstable-sloppy-imports tests/"
  }
}
```

- [ ] **Step 5: Verify Deno tests still pass after the rewrite**

```bash
cd packages/core && deno test --allow-read --unstable-sloppy-imports tests/fixtures.test.ts && cd ../..
```

Expected: `ok | 2 passed | 0 failed`.

If it fails with "module not found", re-check Step 2 — every `.ts` import inside `packages/core/src/` must have become `.js`.

- [ ] **Step 6: Install tsc locally and build**

```bash
cd packages/core
npm install
npm run build
```

Expected: `dist/index.js`, `dist/index.d.ts`, `dist/parser.js`, etc. exist. No errors.

```bash
ls dist/
```

Expected: files present.

- [ ] **Step 7: Smoke-test the built package with Node**

```bash
cd packages/core
node -e "import('./dist/index.js').then(m => console.log(m.isValidKaryotypeNative('46,XX')))"
```

Expected: `true`.

- [ ] **Step 8: Update Deno app imports to match new `.js` extensions**

The Deno app (`deno/main.ts`, `deno/cli.ts`, `deno/lib/validator.ts`) imports from `packages/core/src/` using `.ts` extensions. Deno needs either `--unstable-sloppy-imports` globally, or the imports should continue to use `.ts`.

The cleanest fix: the Deno app continues using `.ts` imports (those paths are Deno-only). Only the core's **internal** imports switched to `.js`. Verify:

```bash
grep "packages/core" deno/main.ts deno/cli.ts deno/lib/validator.ts
```

If any still works with `.ts`, leave it. If broken, update per how the file resolves.

- [ ] **Step 9: Full Deno + Node cross-check**

```bash
# Deno still works:
cd deno && deno check main.ts && cd ..
cd packages/core && deno test --allow-read --unstable-sloppy-imports tests/ && cd ../..

# Node build + smoke still works:
cd packages/core && npm run build && node -e "import('./dist/index.js').then(m => console.log(m.isValidKaryotypeNative('46,XX')))" && cd ../..
```

Expected: all green.

- [ ] **Step 10: Commit the package scaffolding**

```bash
# Add .gitignore for the package
cat > packages/core/.gitignore <<'EOF'
node_modules/
dist/
*.tsbuildinfo
EOF

git add packages/core/package.json packages/core/tsconfig.json packages/core/.npmignore packages/core/.gitignore packages/core/README.md packages/core/deno.json packages/core/src/
git commit -m "add @iscn/core package.json, tsconfig, and Deno config"
```

---

## Task 11: Create top-level pyproject.toml for iscn_authenticator

**Files:**
- Create: `pyproject.toml` (at repo root)

Note: `api/pyproject.toml` already exists for the FastAPI server — leave that one alone. The new root-level one is for the library.

- [ ] **Step 1: Write `pyproject.toml`**

Create `/Users/nuin/Projects/iscn-authenticator/pyproject.toml`:

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "iscn-authenticator"
version = "0.2.0"
description = "ISCN 2024 karyotype validation — parser, rule engine, and types."
readme = "README.md"
requires-python = ">=3.10"
license = { text = "MIT" }
authors = [{ name = "Paulo Nuin" }]
keywords = ["iscn", "karyotype", "cytogenetics", "bioinformatics", "validation"]
classifiers = [
  "Development Status :: 4 - Beta",
  "Intended Audience :: Science/Research",
  "License :: OSI Approved :: MIT License",
  "Programming Language :: Python :: 3",
  "Programming Language :: Python :: 3.10",
  "Programming Language :: Python :: 3.11",
  "Programming Language :: Python :: 3.12",
  "Topic :: Scientific/Engineering :: Bio-Informatics",
]
dependencies = []

[project.urls]
Homepage = "https://iscn.bioinformat.com"
Repository = "https://github.com/nuin/iscn-authenticator"

[tool.hatch.build.targets.wheel]
packages = ["iscn_authenticator"]

[tool.hatch.build.targets.sdist]
include = [
  "iscn_authenticator/",
  "fixtures/",
  "tests/",
  "README.md",
  "pyproject.toml",
]
```

- [ ] **Step 2: Verify the build works**

```bash
pip install hatchling
python -m hatchling build
```

Expected: `dist/iscn_authenticator-0.2.0-py3-none-any.whl` and `dist/iscn_authenticator-0.2.0.tar.gz` created.

```bash
ls dist/
```

Expected: both files listed.

- [ ] **Step 3: Smoke-test install from wheel**

```bash
python -m venv /tmp/iscn-test-venv
/tmp/iscn-test-venv/bin/pip install dist/iscn_authenticator-0.2.0-py3-none-any.whl
/tmp/iscn-test-venv/bin/python -c "from iscn_authenticator.main import is_valid_karyotype; print(is_valid_karyotype('46,XX'))"
```

Expected: `True`.

```bash
rm -rf /tmp/iscn-test-venv dist/
```

- [ ] **Step 4: Add `dist/` to .gitignore**

Check whether `dist/` is already in the root `.gitignore`. If not, append:

```bash
grep -q "^dist/$" .gitignore 2>/dev/null || echo "dist/" >> .gitignore
grep -q "^__pycache__/$" .gitignore 2>/dev/null || echo "__pycache__/" >> .gitignore
```

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml .gitignore
git commit -m "add top-level pyproject.toml for iscn_authenticator PyPI publishing"
```

---

## Task 12: Add GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create workflow directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Write the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  python-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.10", "3.11", "3.12"]
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python ${{ matrix.python-version }}
        uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python-version }}
      - name: Run all unit tests
        run: python -m unittest discover tests/ -v
      - name: Run fixture-driven tests explicitly
        run: python -m unittest tests.test_fixtures -v

  typescript-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Deno
        uses: denoland/setup-deno@v1
        with:
          deno-version: v1.x
      - name: Type-check core
        run: cd packages/core && deno check src/index.ts
      - name: Type-check Deno app
        run: cd deno && deno check main.ts server.ts cli.ts lib/validator.ts
      - name: Run fixture-driven TS tests
        run: cd packages/core && deno test --allow-read --unstable-sloppy-imports tests/

  node-build-smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: Install and build core
        run: cd packages/core && npm install && npm run build
      - name: Smoke-test the built package
        run: |
          cd packages/core
          node -e "import('./dist/index.js').then(m => { if (!m.isValidKaryotypeNative('46,XX')) process.exit(1); })"

  python-build-smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
      - name: Install hatchling and build
        run: |
          pip install hatchling
          python -m hatchling build
      - name: Verify wheel installs and imports
        run: |
          pip install dist/iscn_authenticator-*.whl
          python -c "from iscn_authenticator.main import is_valid_karyotype; assert is_valid_karyotype('46,XX')"
```

- [ ] **Step 3: Commit and push to trigger CI**

```bash
git add .github/
git commit -m "add CI: Python + TS + Node build smoke tests against shared fixtures"
git push -u origin milestone-0-library-consolidation
```

- [ ] **Step 4: Verify CI passes on GitHub**

Visit the GitHub repo PR page. All four jobs should be green:
- `python-tests` (3 matrix entries)
- `typescript-tests`
- `node-build-smoke`
- `python-build-smoke`

If any job fails, investigate the specific failure and fix before proceeding. Do not continue to publishing with red CI.

---

## Task 13: Update root README with monorepo layout

**Files:**
- Modify: `README.md` (existing)

- [ ] **Step 1: Read the current README**

```bash
cat README.md
```

- [ ] **Step 2: Add a "Packages" section**

Insert after the project description (before detailed usage), a new section. Exact content:

```markdown
## Packages

This repository contains three artifacts:

| Package | Language | Distribution | Purpose |
|---|---|---|---|
| `@iscn/core` | TypeScript | npm | Validation library (parser, engine, rules). Pure TS, zero deps. |
| `iscn-authenticator` | Python | PyPI | Equivalent Python validation library. |
| `iscn-validator-api` | Python | Docker / internal | FastAPI HTTP wrapper (self-host). Not published. |

Both `@iscn/core` and `iscn-authenticator` are validated against the shared
corpus at `fixtures/validity.json` on every PR. Any behavioral drift fails CI.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "document monorepo package layout in README"
```

---

## Task 14: Update project CLAUDE.md to reflect new layout

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Read current CLAUDE.md**

```bash
cat CLAUDE.md
```

- [ ] **Step 2: Update the Architecture section**

Replace references to `deno/lib/` with `packages/core/src/` as the source of truth. Add a line about the shared fixture corpus. Exact additions to include:

```markdown
## Monorepo Layout

- `packages/core/` — TypeScript library, published as `@iscn/core` on npm. Source of truth for validation behavior.
- `iscn_authenticator/` — Python library, published as `iscn-authenticator` on PyPI. Mirrors `@iscn/core` behavior.
- `api/` — FastAPI HTTP wrapper, not published (self-host / internal).
- `deno/` — Deno Deploy web app. Imports `packages/core/` directly; contains app-specific multi-mode orchestrator in `deno/lib/validator.ts`.
- `fixtures/validity.json` — Shared test corpus. Both runners must agree. CI enforces this.

## Cross-implementation drift

Any rule change in TypeScript must be mirrored in Python (and vice versa) in the same commit. The shared fixture file is the safety net: if you forget, CI fails. If you need to fix a case that only one runner gets wrong, fix that runner first, then update fixtures if the case was wrong.
```

Find the existing architecture section and insert this content in the appropriate place. Remove outdated references to files now at different paths.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "update CLAUDE.md with monorepo layout and drift discipline"
```

---

## Task 15: Publish packages (MANUAL / one-time)

**⚠️ This task requires human credentials and judgment. Do not automate blindly.**

### Prerequisites (one-time, human action)

1. **npm account:** exists and has access to the `@iscn` scope. If `@iscn` is not owned, create the scope first at npmjs.com.
2. **PyPI account:** exists. API token generated for the `iscn-authenticator` project.
3. **Local login:**
   - `npm login` (for npm)
   - `pip install twine` and configure `~/.pypirc` with API token (for PyPI)

### Publishing

- [ ] **Step 1: Ensure `master` branch has the merged PR**

```bash
git checkout master
git pull
```

- [ ] **Step 2: Tag the release**

```bash
git tag v0.2.0-m0
git push origin v0.2.0-m0
```

- [ ] **Step 3: Publish `@iscn/core@0.1.0` to npm**

```bash
cd packages/core
npm run build
npm publish --access public
cd ../..
```

Expected output includes `+ @iscn/core@0.1.0`.

Verify:

```bash
npm view @iscn/core
```

- [ ] **Step 4: Publish `iscn-authenticator@0.2.0` to PyPI**

```bash
python -m hatchling build
python -m twine upload dist/iscn_authenticator-0.2.0*
```

Expected: upload succeeds; URL printed.

Verify:

```bash
pip install iscn-authenticator==0.2.0
python -c "from iscn_authenticator.main import is_valid_karyotype; print(is_valid_karyotype('46,XX'))"
```

Expected: `True`.

- [ ] **Step 5: Clean up local build artifacts**

```bash
rm -rf dist/ packages/core/dist/
```

- [ ] **Step 6: Confirm gate criterion met**

The spec's M0 gate is: *"both packages install and validate the shared corpus identically."*

To confirm, in a fresh directory:

```bash
# npm side
mkdir /tmp/m0-verify-npm && cd /tmp/m0-verify-npm
npm init -y
npm install @iscn/core
node -e "import('@iscn/core').then(m => console.log(m.isValidKaryotypeNative('46,XX,del(5)(q13q33)')))"
# Expected: true

# PyPI side
python -m venv /tmp/m0-verify-py && source /tmp/m0-verify-py/bin/activate
pip install iscn-authenticator==0.2.0
python -c "from iscn_authenticator.main import is_valid_karyotype; print(is_valid_karyotype('46,XX,del(5)(q13q33)'))"
# Expected: True

# Clean up
deactivate
rm -rf /tmp/m0-verify-npm /tmp/m0-verify-py
```

Both must return the same truthy answer. If they diverge, open an issue immediately and unpublish (npm allows 72-hour unpublish; PyPI does not allow republishing, so you'd yank + release 0.2.1).

---

## Post-Milestone Checklist

- [ ] All 15 tasks completed, all CI green
- [ ] `@iscn/core@0.1.0` live on npm
- [ ] `iscn-authenticator@0.2.0` live on PyPI
- [ ] Gate verification (Task 15 Step 6) passed
- [ ] PR merged to `master`
- [ ] Tag `v0.2.0-m0` pushed
- [ ] Design doc status updated: open `docs/plans/2026-04-16-monetization-v1-design.md` and note M0 shipped

## What This Enables

Milestone 1 (Free tier web app) can now `import { isValidKaryotypeNative } from "@iscn/core"` in a SvelteKit project. The Explain module lands in `packages/core/src/explain/` during M1 and ships in the `@iscn/core@0.2.0` release.

## What Intentionally Wasn't Built

- The Explain module (lands in M1)
- AST-level fixture comparisons (only validity is cross-checked now — if parser drift appears, add AST fixtures later)
- Automated publishing via GitHub Actions (manual-only in M0; M1 or later can add `release-please` or similar)
- Changelog automation
- Version bump automation between the two packages

These are noted for future milestones, not oversights.
