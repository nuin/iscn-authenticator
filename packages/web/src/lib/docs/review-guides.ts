import type { Guide } from './types.js';

export const reviewGuides: Guide[] = [
	{
		slug: 'getting-started',
		title: 'Check your first karyotype',
		description: 'Use the browser workspace, review issues, and save a result.',
		group: 'Review notation',
		keywords: ['quickstart', 'validate', 'example', 'start'],
		sections: [
			{
				id: 'open-the-workspace',
				title: 'Start with an example',
				paragraphs: ['The single-karyotype workspace is available without an account. Enter notation only; patient names, specimen identifiers, and report text are not needed.'],
				steps: ['Open the validator and enter 47,XY,+21, or choose a built-in example.', 'Run the check. Review the result, any issues, and the coverage notice alongside the input, or below it on a narrow screen.', 'Inspect the parsed notation before copying or downloading the result.'],
				note: 'On wider screens, the input stays alongside the result while you scroll through the details. In a short window, scroll within the input panel to reach examples and guides. Editing or clearing the input removes the previous result; run the check again to update it.',
				links: [{ label: 'Open the validator', href: '/validate' }]
			},
			{
				id: 'understand-the-outcome',
				title: 'Treat the outcome as a review aid',
				paragraphs: ['A result with no detected issues means that the implemented checks did not find an error. It does not establish complete ISCN conformity or approve a laboratory report.', 'Some notation is retained by the parser without full rule coverage. Read the coverage notice even when the core result is valid: true.'],
				links: [{ label: 'Read results correctly', href: '/docs/reading-results' }, { label: 'Review coverage and limitations', href: '/docs/coverage' }]
			},
			{
				id: 'keep-a-copy',
				title: 'Keep a copy for your workflow',
				paragraphs: ['Copy or export the result when you need a local record. The browser workspace does not save a server-side validation history. Follow your laboratory’s own review and recordkeeping procedures.', 'For multiple entries, sign in and use batch review. Each line is checked separately.'],
				links: [{ label: 'Review a batch', href: '/docs/batch' }, { label: 'Understand data handling', href: '/docs/data-handling' }]
			}
		]
	},
	{
		slug: 'reading-results',
		title: 'Read a validation result',
		description: 'Understand issues, parsed fields, coverage notices, and JSON exports.',
		group: 'Review notation',
		keywords: ['valid', 'invalid', 'errors', 'parsed', 'null', 'JSON', 'explanation'],
		sections: [
			{
				id: 'result-fields',
				title: 'Three fields describe the core result',
				table: {
					headings: ['Field', 'How to read it'],
					rows: [
						['valid', 'true when the implemented rules return no errors. Coverage gaps can still be present.'],
						['errors', 'An array of detected issues. An empty array is not evidence that every ISCN rule was checked.'],
						['parsed', 'The structured interpretation of the input, or null when parsing fails.']
					]
				},
				code: {
					label: 'Core result for 46,XX',
					value: '{\n  "valid": true,\n  "errors": [],\n  "parsed": {\n    "raw": "46,XX",\n    "chromosome_count": 46,\n    "sex_chromosomes": "XX",\n    "abnormalities": [],\n    "cell_lines": null,\n    "modifiers": null\n  }\n}'
				}
			},
			{
				id: 'issues-and-coverage',
				title: 'Review issues and coverage separately',
				paragraphs: ['An issue is a parser or rule failure. Correct the notation against your source record, then check again. A coverage notice identifies notation that the implementation does not check fully.', 'For example, 46,Y produces rule errors. The input 46,XX,unknown(5) can produce valid: true because an unrecognized abnormality is preserved as type unknown. That result needs manual review.', 'The interface’s coverage notice adds context to the core result. Raw JSON exports preserve the core valid value.'],
				links: [{ label: 'See the coverage limits', href: '/docs/coverage' }]
			},
			{
				id: 'parsed-notation',
				title: 'Inspect the parsed notation',
				items: ['chromosome_count can be a number, a range string such as 45~48, or null for supported FISH-only input.', 'cell_lines is an array for parsed mosaic notation, otherwise null. Every cell line receives the implemented rules; errors identify its one-based position. The original order is preserved, and is_donor identifies lines after a transplant double slash.', 'modifiers is an object when modifiers are present, otherwise null. It is not an array.', 'Each abnormality preserves its source text in raw and may include breakpoints, inheritance, uncertainty, and copy count.'],
				paragraphs: ['A parsed field shows what the parser extracted; it does not mean that every part of that field was validated.']
			},
			{
				id: 'explanations',
				title: 'Use explanations as context',
				paragraphs: ['The example library contains curated notation walkthroughs. Explanation availability is separate from validation coverage. A missing explanation is not a validation error, and an explanation is not a patient-specific interpretation.', 'The chromosome overview is a visual aid derived from parsed input. Use the original notation and the issue list for review.'],
				links: [{ label: 'Browse the example library', href: '/explain' }]
			}
		]
	},
	{
		slug: 'coverage',
		title: 'Coverage and limitations',
		description: 'Know what the current implementation checks and where manual review is required.',
		group: 'Review notation',
		keywords: ['supported', 'unsupported', 'ISCN', 'mosaic', 'unknown', 'FISH', 'nuc ish', 'arr', 'ogm', 'ranges'],
		sections: [
			{
				id: 'implemented-checks',
				title: 'Implemented checks',
				paragraphs: ['The TypeScript core parses karyotype strings and applies a defined set of chromosome and abnormality rules. These include positive integer counts, reliable diploid total consistency, structural chromosome identifiers and cytoband checks against the bundled catalogue.', 'Single-line metaphase counts such as 46,XX[20] are supported. Each parsed cell line receives the implemented rules. This is partial coverage: agreement with the shared test corpus does not demonstrate complete ISCN 2024 implementation.'],
				note: 'Use the result to support a review process. It is not a certification of nomenclature, a diagnosis, or authorization to release a report.'
			},
			{
				id: 'known-gaps',
				title: 'Known limits that affect results',
				table: {
					headings: ['Notation', 'Current behavior'],
					rows: [
						['Unknown abnormalities', 'Unrecognized text can be retained as type unknown and still return valid: true.'],
						['Mosaics and multiple cell lines', 'Counts and normal-last ordering are checked. Supported idem, sl, numbered slN and sdl references resolve to earlier lines while preserving source text. Ambiguous references fail; clone relationships and tie-break ordering still need review.'],
						['FISH, array, and OGM modifiers', 'Accepted nuc ish, arr, and ogm content is retained as modifier text. Assay-specific content is not fully validated.'],
						['Chromosome count ranges', 'Ranges such as 45~48 must have ascending positive safe-integer bounds. Composition and numerical coherence are not inferred.'],
						['Numerical totals', 'Reliable near-diploid cases receive consistency checks. Acquired X/Y changes, polyploid, uncertain, composite and unsupported structural composition require review.'],
						['Cytobands', 'Coarse band existence is checked against UCSC hg38. Finer subbands below catalogue resolution need manual review.'],
						['Derivative and complex descriptions', 'Recognizable flat derivative components receive chromosome, band and breakpoint checks. Abbreviated components, complete paths, centromere reconstruction and complex event relationships still require review.'],
						['Biological or clinical meaning', 'The validator does not establish a finding’s clinical significance or compare it with patient or specimen information.']
					]
				}
			},
			{
				id: 'cell-line-order',
				title: 'Review the cell-line order',
				paragraphs: ['The example below passes the implemented checks: both cell lines are evaluated, their bracketed metaphase counts are positive, and the normal cell line is last even though more normal cells were counted. Optional mos and chi prefixes are supported.', 'Under ISCN 2024 section 4.5.3, normal cell lines follow abnormal lines. The workspace checks this within each recipient or donor group; a double slash preserves the transplant boundary. Normal XX/XY lines are ordered by decreasing count, with XX first for equal counts.', 'When a group contains multiple abnormal cell lines, their ordering still needs review: clone relationships, constitutional versus acquired findings, and tie-break rules require more context. The tool does not infer those relationships or verify donor identity.'],
				code: { label: 'Abnormal cell line followed by normal cell line', value: '47,XX,+21[5]/46,XX[10]' }
			},
			{
				id: 'numbered-stemlines',
				title: 'Keep separate stemline families distinct',
				paragraphs: ['sl1 selects the first clone in the current recipient or donor group. Establish each new numbered source in sequence: exactly one fully written source must follow the last established stemline before the new slN reference. Several full lines may include restated descendants, so ambiguous sources require the line to be written out. An established numbered source stays fixed. In the example, sl2 points to line 3: its doubled descendants inherit the translocation, not the other family’s chromosome 7 loss.', 'idem always points to the group’s first clone, even after another fully written clone. Do not mix idem and sl/sdl notation. Unnumbered sl requires one stemline; with multiple stemlines, this implementation requires sdl references to be written out explicitly so it cannot guess the family.', 'Original notation, selected source line and written additional changes remain in the JSON export. Numbering restarts after the donor boundary //. Composite groups cannot supply a reference and are not silently skipped when resolving a new source. These checks do not establish biological clonality; ordering and transformed clone findings still require review.'],
				code: { label: 'Two stemlines and separate descendants', value: '45,XY,-7[5]/46,sl1,+8[6]/46,XY,t(9;22)(q34;q11.2)[3]/92,sl2x2[5]/93,sl2x2,+8[2]' }
			},
			{
				id: 'expanded-clones',
				title: 'Multipliers, subtraction and composite groups',
				paragraphs: ['References accept positive safe-integer xN or ×N multipliers. Inherited copy counts and sex complements expand while each original line and its written changes remain available in JSON. The expanded sex complement is limited to 4096 characters to bound allocation; this is not an ISCN ploidy limit.', 'A structural loss such as -inv(3) removes the inverted chromosome, so its numerical loss remains unless a normal chromosome 3 is also added. Only a unique, certain inherited single-autosome del, dup, inv, add, trp, qdp, i, r or idic can be subtracted. Missing, ambiguous, uncertain or excessive losses require the clone to be written explicitly.', 'Composite [cpN] counts belong to their own group and can appear beside ordinary cell lines. Their counts contribute to the metaphase denominator, but do not establish per-finding frequency or co-occurrence. Composite groups cannot act as reference clones; per-abnormality bracketed frequencies are not implemented.', 'Expanded operations retain Review required. Numeric totals are checked from a numeric reference when all written changes have inferable count effects. Complete chromosome reconstruction and X/Y arithmetic still need review. Literal previous/current comparison is unavailable when either result contains clone multiplication or subtraction.'],
				code: { label: 'Synthetic examples for review', value: '47,XY,+8[10]/94,idemx2[5]\n46,XX,inv(3)(p21q26)[10]/45,idem,-inv(3)[5]\n45~47,XX,+8[cp12]/46,XX[8]' },
				links: [{ label: 'Review report counts and comparison limits', href: '/docs/report-review' }]
			},
			{
				id: 'evaluate-locally',
				title: 'Evaluate against your laboratory’s notation',
				steps: ['Select representative, non-identifying examples from the notation families your workflow uses.', 'Include known errors and unsupported forms, not only common examples that pass.', 'Record the software version, expected outcome, actual issues, and coverage gaps.', 'Keep a manual review step for unsupported input and decide where the tool fits in your own procedures.'],
				links: [{ label: 'Read result fields', href: '/docs/reading-results' }, { label: 'Report QC and evidence workflows', href: '/docs/report-review' }, { label: 'References and corrections', href: '/docs/review-references' }, { label: 'Evaluate integration options', href: '/docs/integration' }]
			}
		]
	},
	{
		slug: 'batch',
		title: 'Review and export a batch',
		description: 'Check up to 500 entries, inspect each row, and download the results.',
		group: 'Review notation',
		keywords: ['CSV', 'JSON', 'download', 'lines', '500', 'bulk'],
		sections: [
			{
				id: 'prepare-input',
				title: 'Prepare one karyotype per line',
				paragraphs: ['Sign in to open the batch workspace. Batch review is available to signed-in accounts; a paid subscription is not required by the current application.', 'Paste notation only, with one entry per line and at most 500 nonempty entries. Blank lines are ignored and original line numbers are retained. Do not include a spreadsheet header, patient identifiers, or report prose.'],
				code: { label: 'Example batch', value: '46,XX\n47,XY,+21\n46,Y\n46,XX,unknown(5)' },
				links: [{ label: 'Open batch review', href: '/dashboard/batch' }]
			},
			{
				id: 'review-rows',
				title: 'Review every result row',
				steps: ['Run the batch. If it exceeds the limit, split the input into smaller batches and run again.', 'Review detected issues and coverage notes for each entry. Passing rows may still contain unsupported notation.', 'Correct entries against your source records and repeat the check where needed.'],
				paragraphs: ['Batch processing uses the same core checks as the single-karyotype workspace. It does not expand scientific coverage.'],
				links: [{ label: 'Review known coverage gaps', href: '/docs/coverage' }]
			},
			{
				id: 'export-results',
				title: 'Download a local record',
				paragraphs: ['Use CSV for a tabular review or JSON for structured results. Downloads include all results, even when a display filter is active. They are generated in the browser; the application does not keep a server-side batch history.', 'CSV includes Line, Karyotype, Status, Valid, Errors, and Coverage notes. Cells that could be interpreted as spreadsheet formulas are escaped. Use JSON when you need to preserve input text without spreadsheet display conventions.', 'Batch JSON includes the original line number, karyotype, core result, status, and coverage notes for each entry. Retain those notes alongside results: the core valid field alone does not describe completeness.'],
				links: [{ label: 'Understand data handling', href: '/docs/data-handling' }]
			}
		]
	}
];
