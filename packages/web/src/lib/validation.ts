import { getValidationCoverage, validateKaryotypeNative } from '@iscn/core';
import type { KaryotypeAST, ValidationResult } from '@iscn/core';
import { spreadsheetCell } from './csv.ts';
export { spreadsheetCell } from './csv.ts';

export type ReviewStatus = 'Checks passed' | 'Issues found' | 'Review required';

export interface CoverageNote {
	code: string;
	message: string;
}

export interface ValidationReview {
	result: ValidationResult;
	status: ReviewStatus;
	coverage: CoverageNote[];
}

export interface BatchRow extends ValidationReview {
	line: number;
	karyotype: string;
}

function coverageNotes(ast: KaryotypeAST | null): CoverageNote[] {
	if (!ast) return [];
	return getValidationCoverage(ast).notes.map((note) => {
		if (note.code === 'unknown') return { code: 'unsupported', message: 'Unrecognized entries are not checked by a dedicated rule. Review the preserved source text against the reference.' };
		if (note.code === 'clone_order') return { ...note, code: 'cell-line-order' };
		return note;
	});
}

export function reviewKaryotype(input: string): ValidationReview {
	const result = validateKaryotypeNative(input);
	const coverage = coverageNotes(result.parsed);
	const status = !result.valid ? 'Issues found' : coverage.length ? 'Review required' : 'Checks passed';
	return { result, status, coverage };
}

export function reviewBatch(input: string): { rows: BatchRow[]; error: string | null } {
	const lines = input.split(/\r?\n/).map((karyotype, index) => ({ karyotype: karyotype.trim(), line: index + 1 }))
		.filter(({ karyotype }) => karyotype.length > 0);
	if (!lines.length) return { rows: [], error: 'Enter at least one karyotype, with one entry per line.' };
	if (lines.length > 500) return { rows: [], error: `This batch contains ${lines.length} entries. Split it into batches of 500 or fewer; no entries have been processed.` };
	return {
		rows: lines.map((line) => ({ ...line, ...reviewKaryotype(line.karyotype) })),
		error: null,
	};
}

export function batchCSV(rows: BatchRow[]): string {
	const cells = [
		['Line', 'Karyotype', 'Status', 'Valid', 'Errors', 'Coverage notes'],
		...rows.map((row) => [
			String(row.line), row.karyotype, row.status, String(row.result.valid),
			row.result.errors.join('; '), row.coverage.map((note) => note.message).join('; '),
		]),
	];
	return cells.map((row) => row.map(spreadsheetCell).join(',')).join('\r\n');
}

export function downloadValidationFile(content: string, filename: string, contentType: string): void {
	const url = URL.createObjectURL(new Blob([content], { type: contentType }));
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
