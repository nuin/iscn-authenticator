# Quickstart

## Check an entry in the browser

1. Open the [validator](https://iscn-web.pages.dev/validate). No account is required.
2. Enter `47,XY,+21` or choose a built-in example.
3. Run the check. Review issues, coverage notes, and the parsed notation.
4. Copy or download a result if you need a local record.

Checks run in the browser. The entered notation is not uploaded by validation,
and the application does not keep a server-side history. Account actions still
use the server. Avoid patient names and specimen identifiers. A karyotype placed
in a URL is sent with the page request; paste into the workspace instead.

For multiple entries, [sign in](https://iscn-web.pages.dev/login) and open
[batch review](https://iscn-web.pages.dev/dashboard/batch). Supply one karyotype
per line, up to 500 entries. Review row-level issues and coverage before exporting
CSV or JSON. Batch access does not require a paid subscription in the current app.

## Read a result

The core result for `46,XX` is:

```json
{
  "valid": true,
  "errors": [],
  "parsed": {
    "chromosome_count": 46,
    "sex_chromosomes": "XX",
    "abnormalities": [],
    "cell_lines": null,
    "modifiers": null
  }
}
```

`valid: true` means the implemented rules found no errors. It does not establish
complete ISCN conformity. Unknown abnormalities can pass; mosaic rules evaluate
only the first cell line; accepted assay modifiers are retained without full
checks; count ranges bypass numeric bounds and coherence checks.

`valid: false` includes detected issues in `errors`. A parsing failure has
`parsed: null`; a rule failure may still have a parsed result. `cell_lines` is an
array or `null`, and `modifiers` is an object or `null`.

Read the [coverage guide](https://iscn-web.pages.dev/docs/coverage) and
[result guide](https://iscn-web.pages.dev/docs/reading-results) before using the
output in a laboratory workflow.

## Run a local TypeScript check

From a clone of this repository, using Node.js 24:

```bash
npm --prefix packages/core ci
npm --prefix packages/core run build
node --input-type=module -e '
  import { validateKaryotypeNative } from "./packages/core/dist/index.js";
  console.log(JSON.stringify(validateKaryotypeNative("46,XX"), null, 2));
'
```

No API key is needed for local library calls.

## Evaluate HTTP integration

The hosted Pages website has no `/api/validate` service. Its `/validate` page is
the browser workspace. Hosted account keys do not authenticate a Deno deployment.

For a local Deno API, use the same explicit KV path for the CLI and server:

```bash
cd deno
export KV_PATH="$PWD/dev.kv"
deno task keys:create "local-evaluation"
# Save the one-time plaintext key in your approved secret store.
deno task serve
```

In another terminal, set `ISCN_API_KEY` to that Deno key and call:

```bash
curl --fail-with-body http://127.0.0.1:8000/validate \
  -H "Authorization: Bearer $ISCN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"karyotype":"46,XX"}'
```

This CLI-created internal key has no customer quota; it still has the token-bucket
rate limit. The Deno endpoint adds explanation fields to parsed results. See the
[API reference](api.md) for responses, keys, limits, and Python wrapper differences.
Do not expose a development service without reviewing the [operator guide](admin.md).
