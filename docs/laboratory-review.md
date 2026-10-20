# Laboratory report review

The `/review` route is a browser-local workspace with three tools: report QC,
an interphase FISH copy-number builder, and a constitutional CNV evidence
worksheet. No account is required. Review content remains in memory; explicit
downloads are the record. Tool tabs retain their drafts while this page stays
open. Refreshing or navigating away can discard unsaved work; transferring FISH
notation starts a new report form and replaces its previous contents.

Choose **Show documentation** to read the full guide beside the workspace. It
selects the current tool's guide automatically; the guide selector also exposes
the other documentation. On narrow screens the panel sits above the form.
Opening, closing or changing the guide preserves entered data and results.
Reference links open a separate tab.

## Report QC walkthrough

1. Enter current notation and an optional prior result. Use non-identifying data.
2. Select constitutional, neoplastic or unspecified context. Enter the declared
   analyzed-metaphase total if available and select the structured conclusion.
3. Run the checks. Read errors and partial-coverage notes, not just the status.
4. Reconcile source discrepancies and rerun. An edit invalidates the prior result
   and clears its reviewer fields, even if the new text would produce the same status.
5. Enter reviewer name, disposition, rationale and acknowledgment. Export JSON or CSV.

Synthetic example: `47,XX,+21[5]/46,XX[15]`, declared total `20`, conclusion
`abnormality detected`. The line counts are 5 and 15, and percentages 25% and 75%.
A declared total of 25 produces `QC_CELL_TOTAL`. A conclusion of no abnormality
produces `QC_CONCLUSION`. Previous notation `46,XX[20]` yields an added `+21`
description; this is not a claim about biological acquisition.

## Check contract

| Check | Implemented behavior | Boundary |
|---|---|---|
| Notation | Shared core checks every parsed line | See [coverage](notation-coverage.md) |
| Total cells | Reconcile declared total with all usable bracket counts | No inferred counts; incomplete or unsafe sums remain unavailable |
| Percentages | Line count / represented count total, including donor lines | Not a tissue-level mosaicism estimate or pooled assay percentage |
| Conclusion | Compare structured choice with recognized abnormality/complement findings | Free-text narrative is retained for human review; opaque assays cannot prove a normal result |
| Constitutional ordering | Decreasing abnormal-line size within each recipient/donor group | Equal-size tie-breaks and neoplastic relationships still need review |
| Previous/current | Literal abnormality comparison; normalize ×/x and minus glyphs | No clone matching, rearrangement equivalence, clinical response or disease inference |

For comparison, multiplicity is the maximum number of occurrences of a description
within a cell line, not its sum across clones. Thus two `+8` entries in one clone
remain two, while one `+8` shared by two clones is not counted twice. Sex complements,
chromosome totals, line frequencies and donor assignments require separate inspection.
An invalid prior result suppresses comparison; partially covered prior notation
keeps a review warning.

Inputs have limits of 5,000 characters per notation and 10,000 for narrative.
Counts are positive safe integers. The numerical limit is JavaScript's exact
integer ceiling, not a laboratory policy about the number of metaphases to analyze.

### Issue codes

| Code | Meaning |
|---|---|
| `QC_INPUT` | Invalid selection or input length |
| `QC_DECLARED_TOTAL` | Malformed declared cell total |
| `QC_NOTATION` | A core parsing or validation error |
| `QC_COVERAGE_*` | A core coverage limit, with its source code preserved |
| `QC_COUNTS_UNAVAILABLE` | Complete usable counts are unavailable for reconciliation |
| `QC_CELL_TOTAL` | Declared and represented totals differ |
| `QC_CONCLUSION_MISSING` | No structured conclusion selected |
| `QC_CONCLUSION_UNASSESSED` | Insufficient parsed information to reconcile the conclusion |
| `QC_CONCLUSION` | Structured conclusion conflicts with recognized findings |
| `QC_CONSTITUTIONAL_ORDER` | Larger abnormal constitutional line follows a smaller one |
| `QC_PREVIOUS_NOTATION` | Prior/current results cannot be compared |
| `QC_PREVIOUS_COVERAGE` | Prior notation has unresolved coverage limits |

`Issues found` takes precedence over `Review required`, which takes precedence over
`Checks passed`. Core `valid` alone does not describe coverage. `Reviewed` is not
available with unresolved errors; use `Follow-up required`. Review-required results
retain all coverage notes even if a reviewer records a reviewed disposition.

## FISH builder

This builder handles one hybridization and one user-supplied copy-number pattern.
It supports 1–12 distinct probe identifiers made from letters, numbers, underscores,
periods and hyphens. Identifiers are 1–80 characters. It does not look up probes or
verify their required chromosome/pter-to-qter order. Supply the ordered list yourself.
Signal counts are nonnegative safe integers; observed and total nuclei are positive
safe integers. A zero-observation pattern is not emitted as an observed finding.

| Nuclei mode | Required counts | Emitted suffix |
|---|---|---|
| Mixed normal/abnormal | 0 < observed < total | `[observed/total]` |
| One pattern in all nuclei | observed = total | `[total]` |
| Constitutional non-mosaic | observed = total | none |

The latter two modes reflect the count-reporting distinction in ISCN §7.3.1.
The worksheet retains the counted nuclei even when the notation omits them.
All equal signal counts place the ASCII `x` multiplier outside the parentheses;
differing counts place a multiplier beside each probe.

Example: one `D21S259` probe with 3 signals in 10 of 200 nuclei produces
`nuc ish (D21S259)x3[10/200]`. It gives 5%. A laboratory threshold of `>= 5`
is met; `> 5` is not. The comparison uses integer cross multiplication, avoiding
floating-point equality artifacts. Displayed percentage rounding does not alter it.

There is no default cutoff. A supplied cutoff accepts 0–100 with up to six decimal
places and requires a laboratory protocol/version. Meeting it is not a clinical
positive result. Multi-pattern, fusion, break-apart, contiguous-probe, uncertain
and amplified expressions remain manual work. The general core still labels FISH
payloads as partial coverage even when generated by this bounded builder.

Download the FISH worksheet to retain the protocol and threshold. “Use in report
review” transfers only the notation into a new report form.

## Export schemas

### `iscn.review-record.v1`

| Field | Meaning |
|---|---|
| `schema`, `createdAt`, `ruleVersion` | Record contract, client-clock timestamp, application rule revision |
| `references` | IDs, titles, URLs and scope of sources used |
| `input` | Exact notation, prior notation, counts, context, conclusion and narrative |
| `review.inputSnapshot` | Snapshot that binds the computed result to every input field |
| `review.validation` | Core result plus coverage/status |
| `review.issues` | Codes, severity, messages and reference labels |
| `review.lines`, `totalCells` | Per-line counts/percentages and represented total |
| `review.comparison`, `checks` | Literal finding differences and descriptions of what ran |
| `signoff` | Reviewer, disposition, rationale and scope acknowledgment |
| `recordType` | `local-self-attested-review` |

CSV is a header plus one record row, including the scope acknowledgment, record
type, performed checks, validation/coverage result and full issue details.
Nested values use JSON text inside quoted cells. Formula-like cell prefixes are escaped; quotes and embedded newlines are
preserved. Use JSON for exact machine interchange without spreadsheet conventions.

### `iscn.fish-worksheet.v1`

Contains `createdAt`, `ruleVersion`, `references`, `input`, `review`, and `scope`.
The input includes probes, signal counts, nuclei, mode, cutoff, operator and protocol.
The result includes its input snapshot, generated notation, percentage, threshold
comparison and issues. Invalid inputs cannot be exported as a generated worksheet.

### CNV worksheet

See [CNV evidence documentation](cnv-evidence.md) for its independent
`iscn.cnv-evidence.v1` schema and selected scoring categories.

Exports are editable, self-attested local records. They are not authenticated
electronic signatures, independently timestamped approvals or immutable audit trails.
Store them under your laboratory's recordkeeping procedure. This release adds no
server history, shared case storage, team permissions, or hosted validation API.

## Developer architecture and verification

- `src/lib/review/report.ts`: report input, count, conclusion and context checks.
- `comparison.ts`: literal abnormality multiset comparison.
- `fish.ts`: bounded construction and exact threshold comparison.
- `records.ts`: freshness, reviewer requirements and JSON/CSV snapshots.
- `references.ts`: application rule revision and scoped source register.
- `cnv*.ts`: separate evidence model, supported criteria and score computation.
- `components/review/`: forms, results and local exports; input changes invalidate results.
- `routes/review/+page.svelte`: tool navigation; no server action processes review data.

Paths above are relative to `packages/web/`. Core grammar lives in `packages/core/`
and is mirrored in the external Python library. Report QC and worksheet operations
are web-local; they are not new Deno/Python HTTP endpoints.

Run the web unit, build and browser suites in [release instructions](release.md).
Regression cases cover malformed counts, source edits with unchanged computed status,
threshold equality, incomplete evidence, CSV formulas and browser network privacy.
Pilot with adjudicated non-identifying cases before incorporating this workflow
into local procedures. Record misses, false alarms and review time; software test
counts do not establish clinical performance or laboratory acceptance.
