import { evaluationCases } from '../evaluation.ts';
import type { Guide } from './types.js';

export const evaluationGuide: Guide = {
	slug: 'lab-evaluation',
	title: 'Evaluate the workspace for your lab',
	description: 'Run synthetic examples, record observed behavior, and define your own acceptance scope.',
	group: 'Set up your workflow',
	keywords: ['evaluation', 'pilot', 'worksheet', 'acceptance', 'adoption', 'laboratory'],
	sections: [
		{
			id: 'define-the-workflow',
			title: 'Define the work you want to evaluate',
			paragraphs: ['Choose a specific task, such as a first notation check before manual review or a check of an exported batch. Record the notation families you use, the reviewer, the deployment or software revision, the date, and the expected outcome for each example.', 'Keep patient and specimen identifiers out of the evaluation. Use synthetic notation or examples approved for this purpose by your laboratory.'],
			note: 'This starter kit demonstrates application behavior. It is not an independent reference corpus, a clinical validation study, or evidence of complete ISCN conformity.'
		},
		{
			id: 'starter-files',
			title: 'Download the starter files',
			paragraphs: ['The text file contains ten synthetic inputs, one per line. Copy its contents into batch review after signing in, or check each line in the public validator.', 'The CSV worksheet includes the expected interface status and core valid value for these examples, with empty fields for your observations and reviewer notes. These expectations describe the current implementation, including its known limitations.'],
			links: [
				{ label: 'Download starter inputs (.txt)', href: '/evaluation/inputs.txt' },
				{ label: 'Download review worksheet (.csv)', href: '/evaluation/worksheet.csv' },
				{ label: 'Open batch review', href: '/dashboard/batch' }
			]
		},
		{
			id: 'expected-behavior',
			title: 'Compare the observed behavior',
			table: {
				headings: ['Case and notation', 'Expected status / core valid', 'What to inspect'],
				rows: evaluationCases.map((entry) => [
					`${entry.id}: ${entry.notation}`, `${entry.status} / ${entry.valid}`, entry.purpose
				])
			},
			paragraphs: ['Inspect issues and coverage notes, not only the core valid field. E08 deliberately includes a second cell line that would fail checks in isolation; the current engine checks only the first cell line. E09 shows that accepted assay suffixes do not establish complete assay syntax.', 'If an observed result differs, retain the input, raw result, coverage notes, and software revision. Investigate the difference before treating it as accepted behavior.'],
			links: [{ label: 'Understand result fields', href: '/docs/reading-results' }, { label: 'Review known limitations', href: '/docs/coverage' }]
		},
		{
			id: 'check-the-workflow',
			title: 'Exercise the whole review workflow',
			steps: ['Check a single entry and confirm you can inspect its parsed fields and coverage notes.', 'Run the starter batch. Filter by status, then download CSV and JSON. Confirm the downloads retain all ten entries even when a filter is selected.', 'Confirm account-key storage, replacement and revocation fit your access procedures. Keys are individual account credentials; the hosted product has no team roles.', 'Record how your browser, clipboard and downloaded files are managed. The workspace does not save a server-side validation history.'],
			links: [{ label: 'Account and key guide', href: '/docs/accounts-and-keys' }, { label: 'Data handling', href: '/docs/data-handling' }]
		},
		{
			id: 'record-the-decision',
			title: 'Record your own acceptance decision',
			paragraphs: ['Add independently reviewed cases that represent your own notation and known errors. Define expected outcomes before running them. A match on the starter examples alone does not establish suitability for your work.', 'Record the permitted use, exclusions, required manual review, unresolved differences and responsible reviewer. Re-evaluate relevant cases when the software or intended workflow changes.', 'Check current commercial availability separately. This evaluation does not activate a subscription or establish a support commitment.'],
			links: [{ label: 'Plans and availability', href: '/pricing' }]
		}
	]
};
