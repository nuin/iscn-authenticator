# @iscn/core

ISCN 2024 karyotype validation. Pure TypeScript, **zero runtime dependencies**.

Parser + rule engine for strings like `47,XY,+21`, `46,XX,del(5)(q13q33)`, `46,XX,t(9;22)(q34;q11.2)`, `47,XY,+21[8]/46,XY[12]`. Returns a structured `{ valid, errors, parsed }` result.

## Install

```bash
npm install @iscn/core
```

Node ≥ 18. Works in Deno directly from `jsr:` or source; see below.

## Use

```typescript
import { validateKaryotypeNative, isValidKaryotypeNative } from "@iscn/core";

isValidKaryotypeNative("46,XX,del(5)(q13q33)");
// → true

validateKaryotypeNative("47,XY,+21");
// → {
//     valid: true,
//     errors: [],
//     parsed: {
//       chromosome_count: 47,
//       sex_chromosomes: "XY",
//       abnormalities: [{ type: "+", chromosome: "21", raw: "+21" }],
//       cell_lines: [],
//       modifiers: []
//     }
//   }

validateKaryotypeNative("47,XX");
// → { valid: false, errors: ["Total chromosome count (47) does not match ..."], parsed: {...} }
```

Invalid-but-parseable karyotypes return `valid: false` with populated `errors`. Malformed strings that cannot be parsed at all throw `ParseError`.

## Scope

This package is the validation core only — no HTTP, no auth, no rate limiting. If you want a hosted API with keys and quotas, see:

- **HTTP API:** [iscn-authenticator](https://github.com/nuin/iscn-authenticator) — self-host or use the reference deployment.
- **Python equivalent:** [`iscn-authenticator`](https://pypi.org/project/iscn-authenticator/) on PyPI.

## Deno

Direct source import (no build step):

```typescript
import { validateKaryotypeNative } from "npm:@iscn/core";
```

Or from the monorepo with `"unstable": ["sloppy-imports"]`:

```typescript
import { validateKaryotypeNative } from "./packages/core/src/index.ts";
```

## Versioning

Semver. While `0.x`, breaking changes bump the minor. See `CHANGELOG.md` in the repo root.

## License

MIT.

## Links

- Source: https://github.com/nuin/iscn-authenticator/tree/master/packages/core
- Issues: https://github.com/nuin/iscn-authenticator/issues
- Shared fixture corpus (cross-implementation parity): [`fixtures/validity.json`](https://github.com/nuin/iscn-authenticator/blob/master/fixtures/validity.json)
- ISCN 2024 nomenclature reference: `iscn_2024.txt` in the repo root
