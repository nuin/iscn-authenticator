# @iscn/core

ISCN 2024 karyotype validation. Pure TypeScript, **zero runtime dependencies**.

Parser + rule engine for strings like `47,XY,+21`, `46,XX,del(5)(q13q33)`, `46,XX,t(9;22)(q34;q11.2)`, `47,XY,+21[8]/46,XY[12]`. Returns a structured `{ valid, errors, parsed }` result.

## Build from source

Use Node.js 24 LTS (see the repository's `.nvmrc`) and Deno 2.9.7 for development. The TypeScript package is consumed from this repository.

```bash
cd packages/core
npm ci
npm run build
```

## Use

From a Node ES module in `packages/core/`:

```typescript
import { validateKaryotypeNative, isValidKaryotypeNative } from "./dist/index.js";

isValidKaryotypeNative("46,XX,del(5)(q13q33)");
// → true

validateKaryotypeNative("47,XY,+21").valid;
// → true

validateKaryotypeNative("not a karyotype").valid;
// → false
```

Invalid-but-parseable karyotypes return `valid: false` with populated `errors` and a parsed AST. Malformed strings return `valid: false`, errors, and `parsed: null`. Calling `KaryotypeParser.parse()` directly can throw `ParseError`.

## Scope

This package is the validation core only — no HTTP, no auth, no rate limiting. If you want a hosted API with keys and quotas, see:

- **HTTP API:** [iscn-authenticator](https://github.com/nuin/iscn-authenticator) — self-host or use the reference deployment.
- **Python equivalent:** [`iscn-authenticator`](https://pypi.org/project/iscn-authenticator/) on PyPI.

## Deno

Import directly from source, using a script at the repository root and the configured `"unstable": ["sloppy-imports"]` option:

```typescript
import { validateKaryotypeNative } from "./packages/core/src/index.ts";
```

## Tests and shared fixtures

From `packages/core/`:

```bash
npm test                  # fetch pinned fixtures, run Deno tests, then Node tests
npm run fetch-fixtures    # download only
npm run test:deno         # fixture, parser, and explanation tests
npm run test:node         # Node script tests
```

The corpus comes from [iscn-authenticator-py](https://github.com/nuin/iscn-authenticator-py). The `iscn` block in `package.json` pins its repository, release tag, and path; the downloader writes `tests/fixtures/validity.json`. Coordinate validation changes with the Python repository and update that pin when the shared cases change. `ISCN_FIXTURES_TAG_OVERRIDE` can select a different tag for a local comparison.

## Browser bundle

After changing the core, run `npm run build:browser` from `packages/core/`.
This rebuilds the embedded asset in `deno/main.ts` and the local
`deno/static/iscn-core.js` file. Commit the updated embedded asset with the
source changes. The Deno app tests load the embedded module and compare its
validation results with the source implementation.

Run `npm run check:browser` to compare the generated bundle with the embedded asset without writing files. CI runs this check so stale generated code fails the build.

## Versioning

Semver. While `0.x`, breaking changes bump the minor. See `CHANGELOG.md` in the repo root.

## License

MIT.

## Links

- Source: https://github.com/nuin/iscn-authenticator/tree/master/packages/core
- Issues: https://github.com/nuin/iscn-authenticator/issues
- Shared fixture corpus: [`iscn-authenticator-py/fixtures/validity.json`](https://github.com/nuin/iscn-authenticator-py/blob/v0.2.0-py/fixtures/validity.json) (see the `iscn` block in `package.json` for the active pin)
- ISCN 2024 nomenclature reference: `iscn_2024.txt` in the repo root
