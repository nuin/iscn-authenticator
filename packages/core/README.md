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
