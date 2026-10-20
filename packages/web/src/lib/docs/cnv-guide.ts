import type { Guide } from './types.js';

export const cnvGuide: Guide = {
	slug: 'cnv-evidence',
	title: 'Document constitutional CNV evidence',
	description: 'Record sourced assessments, check bounded scores, and export a provisional CNV worksheet.',
	group: 'Review notation',
	keywords: ['CNV', 'copy number', 'ACMG', 'ClinGen', 'constitutional', 'pathogenicity', 'evidence'],
	sections: [
		{
			id: 'scope', title: 'Start with an assessed CNV',
			paragraphs: [
				'The worksheet calculates provisional arithmetic from evidence you enter. It does not infer pathogenicity from ISCN, retrieve evidence, annotate genes or authorize a report. It covers selected constitutional gain/loss criteria and excludes acquired cancer variants.',
				'Use a validated CNV that meets your laboratory reporting criteria. Enter chromosome, GRCh37 or GRCh38, direction, 1-based inclusive coordinates and an externally assessed coding-gene count. Coordinate liftover and chromosome-length checks are not performed. Omit patient identifiers.'
			],
			links: [{ label: 'Open laboratory review', href: '/review' }]
		},
		{
			id: 'evidence', title: 'Record sources and review all sections',
			steps: [
				'Choose a supported criterion. Enter its assessed points, a non-identifying evidence-unit ID, citation/source version and rationale.',
				'Record the sources considered and reasons for selecting, excluding or skipping evidence in each of the five section notes. Confirm each review after writing the note.',
				'Confirm constitutional scope, evidence independence and that no applicable criterion is omitted by the worksheet. If an omitted criterion applies, complete the assessment externally.',
				'For population category 4O, review matching dosage/content, dataset quality, penetrance, sex and recessive carrier caveats. Record reconciliation when positive and negative evidence coexist.',
				'Enter reviewer and assessment date. Keep patient-specific interpretation separate, then calculate and read all reported issues.'
			],
			paragraphs: ['Evidence IDs identify underlying observations or cohorts, not just publications. Reused IDs block calculation; different IDs do not establish independence. The program cannot verify your sources or the adequacy of the clinical assessment.']
		},
		{
			id: 'coverage', title: 'Check category coverage before calculating',
			table: {
				headings: ['Section', 'Supported loss / gain codes'],
				rows: [
					['1 · Content', '1A, 1B / 1A, 1B'],
					['2 · Established dosage/benign evidence', '2A, 2F / 2A, 2C, 2H'],
					['3 · Gene count', '3A, 3B, 3C / 3A, 3B, 3C'],
					['4 · Population', '4O / 4O'],
					['5 · Uninformative inheritance', '5F, 5G, 5H / 5F, 5G, 5H']
				]
			},
			paragraphs: [
				'The worksheet accepts one category per section. Sections 1, 3 and 5 require entries, including zero-point assessments. Sections 2 and 4 may be skipped with a documented reason. This is a conservative software restriction, not the complete guideline.',
				'Partial overlaps, intragenic effects, de novo cases, case series, segregation, case-control studies and informative inheritance require external assessment. Do not omit applicable evidence to obtain a score.',
				'Fixed points and ranges are checked separately for gains and losses. Loss 2A cannot be combined with section 4 in this implementation. No-functional-content evidence must be consistent with the assessed gene count.'
			]
		},
		{
			id: 'results', title: 'Read a provisional result',
			paragraphs: [
				'Unresolved issues suppress both score and category. A fully documented zero-point assessment can produce provisional uncertain significance; an empty worksheet cannot. Points use at most two decimal places and are summed in integer hundredths.',
				'For a synthetic boundary check, loss 3C at 0.90 plus 5G at 0.09 totals 0.99 after completing the other required assessments. Changing the synthetic 5G value to 0.08 totals 0.98. Real evidence must determine the assigned points; these examples are not variant assessments.'
			],
			table: {
				headings: ['Total', 'Provisional category'],
				rows: [['≥0.99', 'Pathogenic'], ['0.90–0.98', 'Likely pathogenic'], ['−0.89–0.89', 'Uncertain significance'], ['−0.98–−0.90', 'Likely benign'], ['≤−0.99', 'Benign']]
			},
			note: 'The result remains provisional. The worksheet does not verify evidence sufficiency, source correctness, reviewer qualifications or patient-specific relevance.'
		},
		{
			id: 'export', title: 'Keep an explicit local record',
			paragraphs: [
				'Entries stay in browser memory. No worksheet payload is sent to a server or saved in localStorage. Reloading or navigating away can discard the assessment. Export JSON explicitly to preserve a draft or completed assessment.',
				'Any form edit clears the displayed result. Identity/evidence edits also clear section confirmations, coverage/independence/population confirmations and reconciliation. Direction changes clear category selections and points. Recheck before using an updated result.',
				'JSON schema iscn.cnv-evidence.v1 includes a fresh input snapshot, recalculated result, issues, limitations, framework/correction references and export timestamp. Incomplete drafts carry null score and category. Reviewer and assessment date are self-reported; authenticated is false. Downloads are editable records without electronic signatures or an immutable audit trail.'
			]
		},
		{
			id: 'references', title: 'Read the pinned framework and correction',
			paragraphs: ['Worksheet 2026-10-19.1 uses selected criteria from Riggs et al. (2020), Tables 1 and 2, Supplement 1 and the 2021 correction. The correction changes the loss 5H default to 0.15; its permitted range remains 0–0.30. This worksheet supplies no default points. References were checked on 2026-10-19; later changes are not automatically incorporated.'],
			links: [
				{ label: 'ACMG/ClinGen constitutional CNV standard', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7313390/' },
				{ label: 'Supplement 1: category explanations', href: 'https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fs41436-019-0686-8/MediaObjects/41436_2019_686_MOESM2_ESM.docx' },
				{ label: '2021 correction', href: 'https://doi.org/10.1038/s41436-021-01150-9' },
				{ label: 'ClinGen explanatory FAQ', href: 'https://clinicalgenome.org/tools/cnv-webinar/faq/' }
			]
		}
	]
};
