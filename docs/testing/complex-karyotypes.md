# Complex-karyotype test report

Updated: 2026-10-21. Core rule revision: `2026-10-20.2`.

The [85-case synthetic corpus](../../packages/core/tests/data/complex-karyotypes.json)
tests the implemented checks, coverage notices and known exclusions. It contains
no patient data. Each case records its input, intended user-visible status,
purpose and, where relevant, required coverage notes, errors or cell total.
These are software regression expectations, not a certification that every
example is a complete, clinically appropriate ISCN description.

## Numbered stemline expansion

C74–C85 add independent stemlines, explicit source selection after intervening
sidelines, donor-local numbering, composite source restrictions, oversized and
forward indices, multiplied totals and reference-style conflicts. The corpus
now contains seven Checks passed, 38 Review required and 40 Issues found outcomes.
All 85 agree between runtimes, including normalized resolved structures.

An `sdl1` after an independent stemline previously selected a sideline without
establishing its family. This bounded implementation now rejects that ambiguity.
Explicit `sl1`/`sl2` select the intended fully written source, while `idem` remains
anchored to the first clone. The new browser export check verifies that the second
family inherits its own translocation and does not acquire the first family's
chromosome 7 loss.

## Previous 73-case expansion (historical)

All 73 expected outcomes agree between Python and TypeScript, including normalized
resolved AST fields, original source text, copy counts, clone references and
composite flags. There are seven Checks passed, 33 Review required and 33 Issues
found results. The original 48 cases remain; C49–C73 add arithmetic, ambiguity,
allocation, derivative-component and composite-context controls.

C40 now rejects its invalid nested chromosome. C41 expands its multiplier, C42
parses mixed composite/ordinary groups, and C43 subtracts the unique inversion
while retaining the implied numerical loss and cancelling a written replacement.
All three accepted expanded forms retain explicit review coverage.

See [notation coverage](../notation-coverage.md#expanded-clones-and-composite-groups)
for field semantics, worked examples and implementation boundaries. Existing
73-case parity and browser tests run the same expected-outcome corpus. Core unit
tests additionally check source immutability, unsafe arithmetic and
dependent sideline behavior. Report tests confirm
that aggregate counts are labelled and transformed clones cannot produce a
misleading literal longitudinal comparison.

The fresh review exposed unsafe intermediate JavaScript arithmetic before numerical
cancellation. C73 reproduces it; both ports now reject unsafe intermediate sums
before applying further operations. The paired regression failed before the fix
and passed afterward.

## Initial 48-case release results (historical)

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

- **Complete derivative reconstruction:** Recognizable flat components and simple
  junction bands are checked. Abbreviated components, chromosome paths, centromere
  identity, phase and sequential-event consistency still require review.
- **General clone arithmetic:** Unique certain single-autosome structural losses
  and reference multiplication are expanded. Explicit numbered stemlines are
  resolved; ambiguous sideline families, ambiguous losses, multi-chromosome/derivative
  subtraction and X/Y arithmetic remain outside this bounded expansion.
- **Composite frequencies:** Group totals are parsed independently. Per-event
  bracketed frequencies and co-occurrence are not reconstructed.
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
argument writes measured results for all 85 cases. It refuses an incomplete
corpus.

Core regressions run with `npm --prefix packages/core test`. Browser regressions
run against the built Pages application:

```bash
npm --prefix packages/web run build
npm --prefix packages/web run test:browser
```

The browser test exercises all 85 inputs through the visible validation form,
checks review notices, and checks that no entered payload is sent in a request.
The existing browser suite also exercises report QC, FISH construction, CNV
worksheets and account workflows.

Initial 48-case release verification (historical): 118 core Deno tests, 7 core Node tests, 292 Python
library tests, 17 API tests on each of Python 3.11 and 3.14, 288 Deno service tests,
108 web tests and 17 browser tests passed. Svelte and Deno type checks, the
production build and embedded browser-bundle checks passed. Aislop remained
99/100 with no errors or fixable warnings; its four retained warnings concern
stable scientific-reference URLs.

See [notation coverage](../notation-coverage.md) and the
[reference register](../reference-register.md) for the limits behind these
outcomes. The same 48 cases passed through the canonical production validation
form after deployment, including FISH JSON export and input-locality checks.
[Release evidence](../releases/2026-10-20-complex-karyotypes.md) identifies the
deployed commit and verification results.
