import { spreadsheetCell } from './csv.ts';
import type { ReviewStatus } from './validation.ts';

interface EvaluationCase {
	id: string;
	notation: string;
	status: ReviewStatus;
	valid: boolean;
	purpose: string;
}

export const evaluationCases: EvaluationCase[] = [
	{ id: 'E01', notation: '46,XX', status: 'Checks passed', valid: true, purpose: 'Baseline notation with no listed abnormalities.' },
	{ id: 'E02', notation: '47,XY,+21', status: 'Checks passed', valid: true, purpose: 'A listed numerical gain.' },
	{ id: 'E03', notation: '46XX', status: 'Issues found', valid: false, purpose: 'Missing count/sex separator; parsing fails.' },
	{ id: 'E04', notation: '46,Y', status: 'Issues found', valid: false, purpose: 'A sex-chromosome rule failure.' },
	{ id: 'E05', notation: '46,XX,del(5)(p13q33)', status: 'Issues found', valid: false, purpose: 'Deletion breakpoints on different arms.' },
	{ id: 'E06', notation: '46,XX,unknown', status: 'Review required', valid: true, purpose: 'Unrecognized abnormality retained without a dedicated rule.' },
	{ id: 'E07', notation: '45~48,XX', status: 'Review required', valid: true, purpose: 'Count range retained without numeric bound checks.' },
	{ id: 'E08', notation: '47,XX,+21[10]/47,XX,+99[5]', status: 'Issues found', valid: false, purpose: 'Invalid chromosome 99 is detected in the second cell line.' },
	{ id: 'E09', notation: '46,XX.arr', status: 'Review required', valid: true, purpose: 'An assay suffix does not receive a complete content check.' },
	{ id: 'E10', notation: '46,XX,inc', status: 'Review required', valid: true, purpose: 'Incomplete notation needs manual review.' }
];

export function evaluationInputs(): string {
	return evaluationCases.map((entry) => entry.notation).join('\n') + '\n';
}

export function evaluationWorksheet(): string {
	const rows = [
		['Case', 'Notation', 'Expected UI status', 'Expected core valid', 'Observed UI status', 'Observed core valid', 'Reviewer notes'],
		...evaluationCases.map((entry) => [entry.id, entry.notation, entry.status, String(entry.valid), '', '', ''])
	];
	return rows.map((row) => row.map(spreadsheetCell).join(',')).join('\r\n') + '\r\n';
}
