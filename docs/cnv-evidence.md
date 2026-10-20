# Constitutional CNV evidence worksheet

The laboratory review workspace contains a browser-local worksheet for documenting selected constitutional copy-number variant evidence. It calculates a **provisional** score from points entered by a reviewer. It does not derive pathogenicity from ISCN, identify genes, retrieve evidence, or authorize a clinical report.

Open `/review`, select the CNV worksheet, and keep the original assay record and evidence sources available. Use this tool only within a laboratory review process. Omit patient names and identifiers from every field, including citations and notes.

## Framework and sources

Worksheet version `2026-10-19.1` implements a bounded subset of the [ACMG/ClinGen constitutional CNV standard, Riggs et al. (2020)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7313390/), DOI `10.1038/s41436-019-0686-8`. Table 1 applies to losses; Table 2 applies to gains. Review the publisher’s [Supplement 1](https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fs41436-019-0686-8/MediaObjects/41436_2019_686_MOESM2_ESM.docx) for the category conditions and caveats.

The [2021 correction](https://doi.org/10.1038/s41436-021-01150-9) changes the loss 5H default from 0.30 to **0.15**; its range remains 0–0.30. The worksheet does not prefill scores. A reviewer must justify the chosen value, including departures from a source default. [ClinGen’s explanatory FAQ](https://clinicalgenome.org/tools/cnv-webinar/faq/) provides additional guidance. Sources were checked on 2026-10-19. This version is not an assertion that all subsequent recommendations or laboratory policies are implemented.

The standard separates variant classification from patient-specific relevance and excludes acquired neoplastic CNVs. This worksheet follows that separation. It does not calculate hematology risk, treatment response, recurrence risk, or somatic actionability.

## Enter the assessment

1. **Identify one CNV.** Enter chromosome 1–22, X or Y; GRCh37 or GRCh38; direction; and 1-based inclusive start/end coordinates. Coordinates must be positive safe integers with end at least start. There is no liftover or chromosome-length validation. Uncertain breakpoints and alternative contigs require an external assessment.
2. **Assess gene content externally.** Enter the assessed coding-gene count. Record the annotation source/version and interval assumptions in the section 3 note and evidence citation. Apply the guideline’s gene-family considerations; this field is not a raw transcript count.
3. **Add evidence rows.** Choose a supported criterion and enter its points, a non-identifying evidence-unit ID, citation/source version, and rationale. An evidence unit identifies the underlying observation, region or cohort, rather than only the publication containing it. A citation can be a DOI, database accession with release, or an internal non-identifying reference.
4. **Review all five sections.** Record sources searched, conclusions, exclusions and justified skips. Check the corresponding review box after writing the note. Sections 1, 3 and 5 require an explicit evidence row, even for zero points. Sections 2 and 4 may have no row when their notes justify the omission.
5. **Confirm scope and independence.** Confirm constitutional scope and validated detection, compatibility with the laboratory’s reporting criteria, coverage of all applicable evidence by the supported categories, and independence of the observations. If omitted criteria are relevant, leave the coverage confirmation unchecked and complete the assessment externally.
6. **Reconcile opposing evidence.** Positive and negative points require a written reconciliation. This records reviewer reasoning; the program cannot determine whether that reasoning is scientifically adequate.
7. **Identify the assessment.** Enter the reviewer and a valid calendar assessment date. Record patient-specific interpretation separately, without identifiers. That text does not change the score.
8. **Calculate and inspect.** Read all issues and scope limitations. Export JSON explicitly when a local record is needed. Drafts with incomplete assessments can also be exported, with null score and category.

## Supported categories

These are software coverage limits. Read the complete source criterion before using an entry; a short option label is not its definition.

| Section | Loss codes | Gain codes | Worksheet constraint |
|---|---|---|---|
| 1 | 1A, 1B | 1A, 1B | Exactly one entry required |
| 2 | 2A, 2F | 2A, 2C, 2H | Zero or one entry |
| 3 | 3A, 3B, 3C | 3A, 3B, 3C | Exactly one; must match assessed count and direction |
| 4 | 4O | 4O | Zero or one entry; population caveat confirmation required |
| 5 | 5F, 5G, 5H | 5F, 5G, 5H | Exactly one entry required |

The code preserves the gain/loss distinction: loss gene bands are 0–24, 25–34 and 35+; gain bands are 0–34, 35–49 and 50+. Gain 2H carries zero points. All fixed scores and permitted ranges are checked before summing.

For 4O, the additional confirmation requires review of matching dosage and gene content, population quality, penetrance, sex and carrier status. Population frequency must not dismiss an established recessive loss-of-function disease gene. These caveats come from Supplement 1; the worksheet cannot verify them.

**Excluded scoring:** partial overlaps, intragenic effects, predicted haploinsufficiency, case series, de novo observations, case-control studies, segregation/non-segregation, informative inheritance and all unlisted criteria. No generic sequence-variant ACMG rule is substituted for an omitted CNV category.

## Calculation and review constraints

| Total points | Provisional category |
|---|---|
| ≥0.99 | Pathogenic |
| 0.90–0.98 | Likely pathogenic |
| −0.89–0.89 | Uncertain significance |
| −0.98–−0.90 | Likely benign |
| ≤−0.99 | Benign |

The thresholds are those in the published tables. The software accepts at most two decimal places and adds integer hundredths, so floating-point rounding cannot move a total across a boundary. Exponents, blanks, NaN, infinity and out-of-range values are rejected.

The worksheet deliberately accepts one category per section and prohibits repeated categories. This is a conservative implementation restriction, not a claim that the full guideline always prohibits multiple independent criteria within a section. More complex assessments belong in an appropriate external workflow.

Evidence-unit IDs are compared after trimming whitespace and ignoring case. Reusing one blocks calculation. Different IDs do not prove independence: the reviewer must detect duplicated cohorts, repeated database submissions and correlated evidence. The same publication may support distinct observations, but those observations need separate provenance and the worksheet’s category constraints still apply.

Other blocking conditions include:

- Missing identity, reviewer, assessment date, citation, rationale, evidence-unit ID, section note or confirmation.
- A section 3 category inconsistent with the entered gene count.
- No-functional-content category 1B combined with positive gene count or an established dosage-sensitive category.
- Loss 2A combined with section 4 scoring: this implementation enforces the loss table’s skip instruction and directs conflicting cases to external review.
- Mixed positive and negative evidence without a reconciliation note.

A completed zero-point assessment produces a provisional uncertain category. An empty worksheet does not. The software verifies presence and internal consistency of reviewer inputs; it does not verify a source, interval, clinical premise, reviewer qualification or evidence sufficiency.

## Editing and data handling

Every form edit clears the displayed result and export message. Identity and evidence edits also clear all section confirmations, the coverage and independence confirmations, the population confirmation, and the reconciliation note. Changing direction clears the selected categories and points while retaining their source text for reassessment. Editing a section note clears its own review checkbox.

The component stores inputs only in browser memory. It makes no evidence or payload request and uses no localStorage, IndexedDB, server history, autosave or telemetry. Navigation or reload can discard the worksheet. Opening a source link navigates to that provider without appending worksheet content. An explicit JSON download contains the entered text and should be handled under the laboratory’s record procedures.

An export is a new snapshot. Later edits cannot alter an already downloaded record. Reviewer names and dates are self-reported; the file is editable and has no authenticated electronic signature or immutable audit trail.

## JSON schema

`createCnvRecord(input, timestamp)` returns:

| Field | Meaning |
|---|---|
| `schemaVersion` | `iscn.cnv-evidence.v1` |
| `exportedAt` | ISO export timestamp; separate from assessment date |
| `authenticated` | Always `false` |
| `coordinateConvention` | `1-based inclusive` |
| `framework` | Publication, DOI, correction DOI, supplement/FAQ URLs, worksheet version, reference-check date and coverage statement |
| `input` | Snapshot of identity, evidence, section notes, confirmations, reviewer/date, reconciliation and patient interpretation |
| `result.status` | `provisional` or `incomplete` |
| `result.score` | Numeric total, or `null` if blocked |
| `result.provisionalClassification` | Category, or `null` if blocked |
| `result.issues` | Stable issue codes and readable messages |
| `result.limitations` | Scope and record limitations carried with the result |

Evidence entries contain `criterion`, `score` (the original numeric text), `evidenceId`, `citation` and `rationale`. The record generator recomputes the result from its input snapshot; it does not trust an earlier displayed result. CNV exports use JSON only, preserving the evidence structure without flattening citations or section notes.

## Synthetic evaluation cases

These are arithmetic and workflow checks, not claims about real variants. Use invented, non-identifying sources clearly marked synthetic. Complete all required section notes and confirmations for cases expected to calculate.

| Case | Inputs and evidence | Expected behavior |
|---|---|---|
| Empty draft | No evidence or section assessments | Incomplete; score/category null |
| Explicit zero assessment | Loss, count 0, 1A=0, 3A=0, 5F=0; documented absence of other applicable evidence | 0.00; provisional uncertain |
| Lower pathogenic boundary | Loss, count 35, 1A=0, 3C=0.90, 5G=0.09 | 0.99; provisional pathogenic |
| Below boundary | Same synthetic assessment, 5G=0.08 | 0.98; provisional likely pathogenic |
| Population boundary | Loss, count 0, 1A=0, 3A=0, 4O=−0.90, 5F=0, population caveats reviewed | −0.90; provisional likely benign |
| Direction mismatch | Gain, count 25, 3B=0.45 | Incomplete: wrong gene-count category |
| Reused observation | Two rows use the same evidence-unit ID | Incomplete: duplicate evidence |
| Stale result | Calculate, then edit an evidence citation | Result disappears and assessment confirmations clear |

Changing the synthetic points demonstrates boundary behavior only. In a real assessment, choose points from evidence strength and the source conditions, never to obtain a desired category.

## Developer verification

Pure functions live in `packages/web/src/lib/review/cnv.ts`, with types and a direction-specific catalogue in adjacent `cnv-*.ts` files. `CnvWorksheet.svelte` owns its browser state, invalidation and download action. It accepts no server-supplied patient data and adds no runtime dependency. The hosted guide is `packages/web/src/lib/docs/cnv-guide.ts`.

Run `node --test tests/cnv.test.mjs` and `npm run check` from `packages/web/`. The focused tests cover exact positive/negative boundaries, empty versus reviewed zero evidence, gain/loss gene thresholds, scoring constraints, conflicts, duplicates, population caveats, malformed coordinates/points/dates, missing provenance and export snapshots. The parent review workspace’s browser checks should exercise entry, invalidation, export, mobile layout and payload-request absence.

Before extending categories, verify the primary source and correction, add cases that fail for the missing behavior, define exclusivity and cumulative limits, and update both catalogue and documentation. Changing the framework or interpretation of supported criteria requires a new worksheet version and explicit review of existing evaluation cases.
