import { needsCellLineOrderReview, validateKaryotypeNative } from '@iscn/core';
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

const CHECKED_TYPES = new Set([
	'+', '-', 'del', 'dup', 'inv', 't', 'r', 'i', 'trp', 'qdp', 'dic', 'idic',
	'rob', 'add', 'fra', 'ins', 'dmin', 'hsr', 'psu dic', 'ace', 'tas', 'fis', 'neo', 'inc',
]);

function coverageNotes(ast: KaryotypeAST | null, input: string): CoverageNote[] {
	if (!ast) return [];
	const notes: CoverageNote[] = [];
	const abnormalities = [
		...ast.abnormalities,
		...(ast.cell_lines?.flatMap((line) => line.abnormalities) ?? []),
	];
	const unchecked = [...new Set(abnormalities.filter((item) => !CHECKED_TYPES.has(item.type)).map((item) => item.raw))];
	if (unchecked.length) {
		notes.push({ code: 'unsupported', message: `These entries are not checked by a dedicated rule: ${unchecked.join('; ')}. Review them against the reference.` });
	}
	if (needsCellLineOrderReview(ast)) {
		notes.push({ code: 'cell-line-order', message: 'Every cell line was checked. Ordering multiple abnormal cell lines still needs review against specimen context, clone relationships and ISCN tie-break rules.' });
	}
	if (ast.cell_lines?.length && input.includes('//')) {
		notes.push({ code: 'donor', message: 'Recipient and donor groups were checked separately. Confirm donor identity and transplant context against the source records.' });
	}
	if (typeof ast.chromosome_count === 'string' || ast.cell_lines?.some((line) => typeof line.chromosome_count === 'string')) {
		notes.push({ code: 'range', message: 'Chromosome-count ranges are retained as text. Their bounds and count coherence are not checked.' });
	}
	if (/\.ish\s|\.arr|\.ogm|^nuc ish\s/.test(input.trim())) {
		notes.push({ code: 'assay', message: 'FISH, array and optical genome mapping extensions are retained as text; their assay syntax and content are not checked.' });
	}
	if (ast.modifiers?.composite !== undefined || ast.modifiers?.incomplete || abnormalities.some((item) => item.type === 'inc')) {
		notes.push({ code: 'modifier', message: 'Composite or incomplete notation needs manual review. The modifier does not receive a full consistency check.' });
	}
	return notes;
}

export function reviewKaryotype(input: string): ValidationReview {
	const result = validateKaryotypeNative(input);
	const coverage = coverageNotes(result.parsed, input);
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
