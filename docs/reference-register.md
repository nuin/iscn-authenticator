# Reference register

Review date: 2026-10-19. Core/application rule revision: `2026-10-19`.
CNV worksheet revision is independently recorded in its exported framework metadata.

This register distinguishes consulted sources from implemented coverage. A source
listed here is not a claim that all its rules are implemented. Rule changes require
tests, parity where applicable, a new rule revision, and updated documentation.

| Reference | Use | Implementation boundary |
|---|---|---|
| [ISCN 2024, DOI 10.1159/000538512](https://doi.org/10.1159/000538512) | Nomenclature; local reference extraction | Selected grammar and checks, described in the coverage matrix |
| [Erratum, DOI 10.1159/000549238](https://doi.org/10.1159/000549238), online December 2025 | Corrected chromosome totals and related-clone descriptions; relevant structural/FISH corrections reviewed | No claim of complete derivative, recombinant, FISH or array correction coverage |
| [Earlier erratum, DOI 10.1159/000546684](https://doi.org/10.1159/000546684) | Part of the reference maintenance register | Recheck relevant sections when extending grammar; not a blanket applied-rule claim |
| [Earlier erratum, DOI 10.1159/000543493](https://doi.org/10.1159/000543493) | Part of the reference maintenance register | Same bounded treatment |
| [ISCN 2024 revisions overview](https://doi.org/10.1159/000544969) | Scope and technology-family context | An overview does not replace the nomenclature reference |
| [UCSC hg38 cytoBand](https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/cytoBand.txt.gz) | Bundled chromosome/band consistency checks and reference ideograms | Resolution-limited catalogue, not a complete ISCN atlas or patient-specific coordinates |
| [ACMG/ClinGen CNV standard](https://doi.org/10.1038/s41436-019-0686-8) and [2021 correction](https://doi.org/10.1038/s41436-021-01150-9) | Selected constitutional CNV evidence categories and score thresholds | See the dedicated worksheet guide; many categories are intentionally outside the calculator |

The local ISCN text is an extraction of the original publication. Consult later
errata alongside it. Do not redistribute the publication or copy its example corpus
into public fixtures; tests in this release use synthetic cases and short notation
examples to exercise implemented behavior.

## Application rules versus standard rules

Report total reconciliation, structured-conclusion comparison, literal finding
differences and export freshness are application QC requirements. They are not
invented additions to ISCN. Their issue reference identifies the application rule
revision. ISCN-based order checks identify §4.5.3, and the bounded FISH constructor
uses §7.3.1. The CNV evidence worksheet is a separate framework and is never derived
from the core parser's `valid` flag.

The numerical cutoff entered in the FISH builder belongs to the laboratory. Its
protocol/version is recorded as user-supplied provenance, not endorsed or independently
verified by the application.

## Maintaining the register

1. Identify the exact source edition, correction and affected behavior.
2. Add independent expected examples, including exclusions and nearby invalid forms.
3. Implement shared validation changes in TypeScript and Python, then advance the
   immutable fixture and API dependency pins.
4. Update coverage notices, source scope, rule revision and evaluation cases.
5. Rebuild the embedded Deno browser bundle and the Pages app; run release checks.
6. Record the deployed commit and deployment URL in release evidence.

Do not silently reclassify an old CNV worksheet or reinterpret a prior review after
updating rules. Produce a new record with the new version and retain the prior record
under the laboratory procedure.
