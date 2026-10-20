# Laboratory review and notation coverage

## Intent

Build the laboratory QC workflow approved after the coverage audit: repair routine notation checks, provide a browser-local report review workspace, and add a constitutional CNV evidence worksheet. Documentation is part of each deliverable. This builds on the existing SvelteKit application and TypeScript/Python validators.

## Deliverables

1. Routine notation: single-line metaphase counts, count consistency when the notation permits a reliable total, structural chromosome identifiers, cytoband existence against the bundled reference, and explicit handling of related-clone shorthand. Preserve original input and identify unsupported cases rather than inventing structure.
2. Report review: compare a current and optional previous karyotype, declared analyzed-cell total, specimen context, and a structured report conclusion. Expose per-line counts and percentages, errors, coverage notes, and findings added/removed/retained. Do not infer biological clone identity from string similarity.
3. FISH construction: generate a bounded interphase copy-number expression from probe names, signal counts, and abnormal/total nuclei; check counts and compare the percentage with a laboratory-specified cutoff and boundary operator. No default clinical cutoff. Complex fusion/break-apart patterns remain explicitly outside this builder.
4. Review records: reviewer name, disposition, rationale, source inputs, check results, rule/reference versions, and timestamp in downloadable JSON and spreadsheet-safe CSV. Any input change invalidates the previous review. Records are local exports, not authenticated electronic signatures or an immutable server audit trail.
5. Constitutional CNV evidence worksheet: record variant identity, assembly, gain/loss, evidence citations and assessment date; organize supported ACMG/ClinGen evidence categories and calculate only a bounded, documented score when required evidence and category constraints are satisfied. Never infer pathogenicity from ISCN notation. Preserve patient-specific interpretation separately. Hematology clinical-risk automation remains future work requiring disease/molecular inputs and a separately validated framework.
6. Documentation: user walkthroughs, notation coverage matrix, versioned references/errata, data handling, export schema, evaluation cases, developer architecture, verification and deployment notes.

## Constraints

- Core source imports use `.js`; no runtime dependencies in the core.
- Changes to shared validation semantics must be mirrored in the external Python repository and the pinned fixture corpus.
- Use ISCN 2024 and applicable published errata; distinguish the UCSC hg38 band catalogue from a complete ISCN atlas.
- Unknown or partially interpreted notation must remain visible as requiring review. Passing checks is not full ISCN compliance.
- Do not send notation, findings or report content to a server; no localStorage or hidden persistence. Export is explicit.
- Keep individual source files below 400 lines where practical. Do not relax aislop rules.
- Preserve existing account/billing functionality and the unrelated `.cairn` file.
- No invented clinical claims, laboratory thresholds, evidence, classifications or reviewer identities.

## Acceptance

The four audited failures have regression coverage. Supported clone references resolve without losing raw descriptions, and ambiguous references receive explicit feedback. QC catches a declared-total mismatch and incompatible structured conclusions. FISH handles threshold equality, invalid counts and unsafe probe tokens. Changing a reviewed field invalidates the record. CNV results retain provenance and incomplete/conflicting evidence cannot produce an unqualified classification. Desktop/mobile browser tests exercise entry, review and export with no payload-bearing requests. Core/Python parity, web tests, builds and aislop pass before deployment.
