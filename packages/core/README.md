# @iscn/core

ISCN 2024 karyotype validation. Pure TypeScript, zero runtime dependencies.

Part of the [`iscn-authenticator`](https://github.com/nuin/iscn-authenticator) monorepo. Not published — use from source.

## Use from source

**Deno:** import the `.ts` sources directly (requires `--unstable-sloppy-imports` to resolve `.js` specifiers back to `.ts`).

```typescript
import { validateKaryotypeNative, isValidKaryotypeNative } from "./packages/core/src/index.ts";

isValidKaryotypeNative("46,XX,del(5)(q13q33)"); // true
validateKaryotypeNative("46,XX,del(5)");        // { valid: false, errors: [...] }
```

**Node:** build and import the compiled output.

```bash
cd packages/core
npm install
npm run build       # emits dist/
```
```typescript
import { isValidKaryotypeNative } from "./packages/core/dist/index.js";
```

## Tests

```bash
deno test --allow-read --unstable-sloppy-imports tests/
```

## License

MIT. See `LICENSE` in the repository root.

## Related

- Python implementation: `iscn_authenticator/` in the repo root (run via `python -m unittest` or `pip install .` locally)
- Shared cross-implementation fixture corpus: `fixtures/validity.json`
