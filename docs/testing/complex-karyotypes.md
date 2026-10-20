# Complex-karyotype test report

Date: 2026-10-20. Core rule revision: `2026-10-20`.

The [48-case synthetic corpus](../../packages/core/tests/data/complex-karyotypes.json)
tests the implemented checks, coverage notices and known exclusions. It contains
no patient data. Each case records its input, intended user-visible status,
purpose and, where relevant, required coverage notes, errors or cell total.
These are software regression expectations, not a certification that every
example is a complete, clinically appropriate ISCN description.

## Results

After the interphase-prefix fix, all 48 cases match their expected outcomes in
TypeScript and Python. Both implementations agree on validity, error messages,
coverage level, coverage notes and rule/reference metadata:

| User-visible outcome | Cases | Meaning |
|---|---:|---|
| Checks passed | 7 | No errors or coverage exceptions within the implemented subset |
| Review required | 23 | Parsed, with explicit limits or unresolved notation |
| Issues found | 18 | Detected error or rejected unsupported grammar |

The seven passing cases include the normal control. Of the 18 rejected cases,
three exercise known unsupported notation families: multiplied clone references,
mixed composite/noncomposite lines and standalone arrays. Rejection of those
families does not establish that the submitted notation is invalid under ISCN.

## Representative cases

| Case | Synthetic input | Expected outcome |
|---|---|---|
| C02 | `46,XX,del(5)(q13q33),-7,+8,t(9;22)(q34;q11.2)[20]` | Checks passed |
| C03 | `46,XY,t(2;8;14)(p21;q24;q32)[20]` | Checks passed |
| C09 | `46,XY,t(2;8)(p21;q24)[8]/47,idem,+12[6]/47,idem,+9[4]/46,XY[2]` | Review required: abnormal-clone ordering |
| C10 | `46,XX,t(2;8)(p21;q24)[8]/47,sl,+12[6]/48,sdl1,+9[4]/49,sdl2,+10[2]` | Review required: abnormal-clone ordering |
| C12 | `44~48,XX,del(5)(q13q33),-7,+8,+mar[cp20]` | Review required: composite frequencies and totals |
| C15 | `46,XX,der(5)t(5;12)(q13;p13),del(7)(q22q36)[20]` | Review required: nested derivative |
| C26 | `47,XX,del(5)(q13q33),-7,+8,t(9;22)(q34;q11.2)[20]` | Issues found: expected total 46 |
| C28 | `47,XX,+8[12]/47,XX,+99[8]` | Issues found in cell line 2 |
| C45 | `nuc ish(D21S259)x3[25/100]` | Review required: unvalidated assay payload |

The corpus also covers four-chromosome translocations, inter- and
intrachromosomal insertions, donor groups, hyperdiploid/polyploid totals, rings,
dicentrics, markers, uncertain findings, finer subbands, FISH, arrays and OGM.
Clean/corrupted pairs exercise chromosome totals, missing breakpoints, ring arms,
normal-line ordering, cell counts and invalid prefixes.

## Defect found and fixed

The original parser required one literal space after `nuc ish`. Compact
`nuc ish(...)` and tab-separated input bypassed interphase handling. A slash in
the nuclei fraction then entered mosaic parsing and generated an unrelated
cell-count error.

Both parsers now recognize the prefix followed by a parenthesis, spaces or tabs,
before looking for cell-line separators. They preserve the complete raw input and
assay payload, leave `cell_lines` and `chromosome_count` null, and retain partial
assay coverage. `nuc ishx(...)` still fails. This fixes routing only; it does not
validate arbitrary FISH syntax or interpret signal patterns.

The compact form was checked against the local ISCN 2024 interphase material
(§7.3). The first regression run demonstrated four failing TypeScript tests and
two failing Python subcases before the implementation changed. All passed after
the fix. One initial audit assertion expected a missing-comma diagnostic for a
standalone array; that assumption was removed because unsupported array syntax
currently fails at bracket parsing. Its expected rejection was unchanged.

Python implementation: `e7ea7438b4ef6aa944717b2ff5dc19cbc215abe8`.
Shared validity corpus tag: `fixtures-complex-review-20261020`.

## Remaining gaps demonstrated by the tests

- **Nested derivative validation:** C40 deliberately uses chromosome 99 and band
  p99 inside a derivative. It receives a complex-structure review notice, but no
  nested error. The outer derivative chromosome alone is checked.
- **Clone subtraction:** C43 preserves `-inv(3)` as an unknown token. The resolved
  abnormality list still includes the inherited inversion; it is not a fully
  reconstructed clone. Review the source or restate the clone explicitly.
- **Polyploid clone references:** C41 rejects `idemx2`. Multiplier expansion is
  not implemented.
- **Mixed composite lines:** C42 rejects `[cp12]/...`; only the documented final
  composite form is supported.
- **Assay grammar and diagnostics:** FISH, appended array and OGM payloads remain
  partial. Standalone array C44 is unparsed and currently receives a generic
  cell-count error, not a dedicated array-coverage explanation.
- **Ordering and classification:** Multiple abnormal clones still need contextual
  ordering review. These checks do not infer biological clonality, a diagnosis,
  ELN risk, WHO/ICC classification or CNV pathogenicity.

Python and TypeScript share parser design, fixtures and the band catalogue.
Their agreement establishes parity, not independent nomenclature validation.
The expected outcomes were authored before running this corpus; the new spacing
cases are regression controls derived from the discovered failure.

## Repeat the checks

From the repository root, build core, install the pinned API dependency, and run
the parity audit:

```bash
npm --prefix packages/core run build
uv sync --project api --locked
node packages/core/scripts/check-complex-parity.mjs api/.venv/bin/python /tmp/iscn-complex-results.json
```

The audit exits nonzero on any unexpected status, missing expected diagnostic or
coverage note, wrong cell total, or Python/TypeScript mismatch. Its optional final
argument writes measured results for all 48 cases. It refuses an incomplete
corpus.

Core regressions run with `npm --prefix packages/core test`. Browser regressions
run against the built Pages application:

```bash
npm --prefix packages/web run build
npm --prefix packages/web run test:browser
```

The browser test exercises all 48 inputs through the visible validation form,
checks review notices, and checks that no entered payload is sent in a request.
The existing browser suite also exercises report QC, FISH construction, CNV
worksheets and account workflows.

Verification for this change: 118 core Deno tests, 7 core Node tests, 292 Python
library tests, 17 API tests on each of Python 3.11 and 3.14, 288 Deno service tests,
108 web tests and 17 browser tests passed. Svelte and Deno type checks, the
production build and embedded browser-bundle checks passed. Aislop remained
99/100 with no errors or fixable warnings; its four retained warnings concern
stable scientific-reference URLs.

See [notation coverage](../notation-coverage.md) and the
[reference register](../reference-register.md) for the limits behind these
outcomes. Deployment and live verification are recorded separately in the release
evidence.
