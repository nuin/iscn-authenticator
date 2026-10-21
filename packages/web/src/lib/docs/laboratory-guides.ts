import type { Guide } from './types.js';

export const laboratoryGuides: Guide[] = [
	{
		slug: 'report-review', title: 'Review a laboratory report',
		description: 'Reconcile notation, metaphase counts and the structured conclusion, compare a prior result, and export your review.',
		group: 'Review notation', keywords: ['QC', 'report', 'signoff', 'cell counts', 'percentages', 'comparison', 'audit', 'reviewer'],
		sections: [
			{ id: 'workflow', title: 'Run a report review', steps: [
				'Open Report review. Enter the current notation and, optionally, the previous notation. Use non-identifying content.',
				'Select specimen context, enter the analyzed-metaphase total if available, and select the structured conclusion.',
				'Run the checks. Read every issue and coverage note, inspect the cell counts and review any previous/current differences.',
				'Correct source discrepancies and run again. Every input edit clears the result and reviewer fields.',
				'Enter your reviewer name, disposition and rationale, acknowledge the limits, then download JSON or CSV.'
			], links: [{ label: 'Open laboratory review', href: '/review' }] },
			{ id: 'checks', title: 'What is compared', table: { headings: ['Check', 'Behavior'], rows: [
				['Notation', 'Runs the shared core on every parsed cell line and retains partial-coverage notices.'],
				['Analyzed metaphases', 'Compares your declared total with the sum of usable bracketed counts. Missing counts are not filled from your declaration.'],
				['Percentages', 'Each line count divided by all represented metaphases, including recipient and donor groups. This is a count percentage, not a tissue-level mosaicism estimate.'],
				['Structured conclusion', 'Flags disagreement between no-abnormality/abnormality-detected and recognized parsed findings. Unknown findings and opaque assays cannot establish a normal conclusion.'],
				['Constitutional ordering', 'Checks decreasing sizes of abnormal constitutional lines within each recipient/donor group. Equal-size and neoplastic ordering still need review.'],
				['Previous/current', 'Compares literal abnormality descriptions, preserving the largest within-line multiplicity. Does not infer clone identity, evolution, equivalence or resolution of disease.'],
				['Narrative', 'Preserved in the export for the reviewer. Free-text clinical claims are not automatically interpreted.']
			] } },
			{ id: 'example', title: 'A synthetic count reconciliation', code: { label: 'Current notation; declared total 20; conclusion abnormality detected', value: '47,XX,+21[5]/46,XX[15]' }, paragraphs: [
				'The represented total is 20. The line percentages are 25% and 75%. Declaring 25 analyzed cells produces QC_CELL_TOTAL; choosing no abnormality produces QC_CONCLUSION.',
				'With previous notation 46,XX[20], +21 appears under added findings. That label means present in the parsed current notation and absent from the parsed prior notation. It is not an inference about biological acquisition.'
			] },
			{ id: 'record', title: 'Keep the review with its limits', paragraphs: [
				'JSON uses schema iscn.review-record.v1 and retains exact inputs, checks, coverage, line counts, comparison, references, rule version, reviewer decision and export timestamp. CSV provides a single spreadsheet-safe row with those fields; embedded structures use JSON text.',
				'Reviewed is unavailable while errors remain. Follow-up required preserves unresolved errors. A review-required result can be recorded as reviewed only with the explicit scope acknowledgment and rationale; recording a decision does not remove coverage notes.',
				'The record is local and self-attested. It has no authenticated signature, independent timestamp or immutable audit history. Store it under your laboratory recordkeeping procedure. The app does not retain it after you leave.'
			], links: [{ label: 'References and versioning', href: '/docs/review-references' }, { label: 'Data handling', href: '/docs/data-handling' }] }
		]
	},
	{
		slug: 'fish-builder', title: 'Construct a FISH expression',
		description: 'Build one interphase copy-number pattern and compare its observed percentage with your laboratory threshold.',
		group: 'Review notation', keywords: ['FISH', 'nuc ish', 'probe', 'signals', 'nuclei', 'threshold', 'cutoff'],
		sections: [
			{ id: 'scope', title: 'One hybridization and one signal pattern', paragraphs: [
				'Enter one to twelve probe identifiers and their signal counts. Probes must come from the same hybridization. Supply the required chromosome and pter-to-qter order yourself; identifiers are checked for supported characters, not against a probe catalogue.',
				'Fusion, break-apart, contiguous-probe, amplified, uncertain and multi-pattern expressions are outside this builder. It neither identifies probes nor validates the assay. The general validator continues to mark FISH text as partial coverage.'
			], steps: ['Select FISH builder in laboratory review.', 'Enter the ordered probe identifiers and observed signal counts, then observed and total nuclei.', 'Choose the nuclei reporting mode.', 'Optionally enter the laboratory cutoff, > or ≥, and the laboratory protocol/version.', 'Build, inspect and copy the notation or download the FISH worksheet.'], links: [{ label: 'Open the builder', href: '/review' }] },
			{ id: 'count-formats', title: 'Choose the count format', table: { headings: ['Mode', 'Requirement', 'Output suffix'], rows: [
				['Mixed normal and abnormal', 'At least one observed nucleus; fewer observed than total. The entered pattern is the abnormal one.', '[observed/total]'],
				['One pattern in all nuclei', 'Observed equals total; appropriate when counts are reported for a neoplastic study.', '[total]'],
				['Constitutional, non-mosaic', 'Observed equals total; counts are retained in the worksheet.', 'No count suffix']
			] }, paragraphs: ['Counts must be positive safe integers. Signal counts can include zero. A zero-observation pattern is not emitted as an observed finding. When all probes have the same signal count, the multiplier follows the closing parenthesis; differing counts stay next to each probe. The builder emits ASCII x.'] },
			{ id: 'threshold', title: 'Use the laboratory’s threshold', code: { label: 'Synthetic pattern: 10 of 200 nuclei, one probe with three signals', value: 'nuc ish (D21S259)x3[10/200]' }, paragraphs: [
				'This example gives 5%. With a cutoff of 5%, ≥ meets the threshold and > does not. The comparison uses exact integer arithmetic; display rounding does not control the outcome.',
				'No cutoff is supplied by the application. A provided cutoff must be between 0 and 100, with up to six decimal places, and must include a protocol reference. Meeting the entered threshold is not a clinical positive result.'
			] },
			{ id: 'export', title: 'Retain the complete worksheet', paragraphs: [
				'The iscn.fish-worksheet.v1 JSON download includes probe inputs, nuclei, reporting mode, cutoff, operator, protocol, calculated result, rule version and references. Input edits invalidate the generated result.',
				'Use in report review transfers the notation only into a new report form. Retain the FISH worksheet separately to preserve its threshold and protocol. The report form does not reinterpret those parameters.'
			], links: [{ label: 'Review references', href: '/docs/review-references' }] }
		]
	},
	{
		slug: 'review-references', title: 'Review references and versions',
		description: 'Distinguish notation standards, catalogue checks, application QC and clinical evidence scoring.',
		group: 'Set up your workflow', keywords: ['ISCN 2024', 'errata', 'UCSC', 'version', 'ACMG', 'ClinGen', 'rules', 'provenance'],
		sections: [
			{ id: 'notation', title: 'Notation and corrections', paragraphs: [
				'The nomenclature reference is ISCN 2024. Core notation checks use revision 2026-10-20.2; laboratory QC rules use revision 2026-10-20. Cell-line and FISH work uses the relevant general, clonal-evolution and interphase sections; coverage remains bounded.',
				'The later erratum includes corrected chromosome totals and related-clone examples. Its relevant corrections were consulted; inclusion in a record does not mean every affected grammar family has been implemented. The repository reference register records these limits.'
			], links: [{ label: 'ISCN 2024', href: 'https://doi.org/10.1159/000538512' }, { label: 'Erratum, DOI 10.1159/000549238', href: 'https://doi.org/10.1159/000549238' }, { label: 'Coverage matrix', href: '/docs/coverage' }] },
			{ id: 'bands', title: 'Band catalogue checks', paragraphs: [
				'Chromosome names and supported breakpoint designations are checked against the bundled UCSC hg38 cytoband data. This catches nonexistent coarse bands, but is not a complete ISCN band atlas. A finer designation below catalogue resolution requires review.',
				'Reference coordinates describe hg38 cytobands. They do not establish the genomic boundaries of a patient rearrangement or provide array coordinate liftover.'
			], links: [{ label: 'UCSC hg38 cytoband data', href: 'https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/cytoBand.txt.gz' }] },
			{ id: 'application-rules', title: 'Application QC and clinical evidence', paragraphs: [
				'Declared-total checks, structured-conclusion reconciliation and literal previous/current comparisons are application rules. They are documented as QC rules rather than attributed to an ISCN section that does not define them.',
				'The CNV worksheet uses selected reviewer-assessed categories from the ACMG/ClinGen constitutional CNV framework, including its 2021 correction. Clinical significance is a separate evidence assessment, not a result of parsing notation.',
				'No ELN, WHO or ICC diagnostic/risk classification is calculated. Such modules require their own disease, molecular, treatment-context and version-specific assessment.'
			], links: [{ label: 'CNV evidence worksheet', href: '/docs/cnv-evidence' }, { label: 'Report QC rules', href: '/docs/report-review' }] }
		]
	}
];
