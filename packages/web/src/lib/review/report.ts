import { isNormalCellLine } from '@iscn/core';
import type { KaryotypeAST } from '@iscn/core';
import { reviewKaryotype } from '../validation.ts';
import type { ValidationReview } from '../validation.ts';
import { compareFindings } from './comparison.ts';
import { integerCount } from './references.ts';
import type { ReportInput, ReportReview, ReviewedCellLine, ReviewIssue } from './types.ts';

function issue(code: string, message: string, severity: ReviewIssue['severity'] = 'error', reference = 'Laboratory QC rule 2026-10-19'): ReviewIssue {
	return { code, message, severity, reference };
}

function inputIssues(input: ReportInput): ReviewIssue[] {
	const issues: ReviewIssue[] = [];
	if (!['unspecified', 'constitutional', 'neoplastic'].includes(input.context) || !['not-entered', 'no-abnormality', 'abnormality-detected'].includes(input.conclusion)) {
		issues.push(issue('QC_INPUT', 'Select a recognized specimen context and report conclusion.'));
	}
	if (input.notation.length > 5000 || input.previousNotation.length > 5000 || input.reportText.length > 10000) {
		issues.push(issue('QC_INPUT', 'Limit each notation to 5,000 characters and the narrative to 10,000 characters.'));
	}
	if (input.analyzedCells.trim() && integerCount(input.analyzedCells) === null) issues.push(issue('QC_DECLARED_TOTAL', 'Declared analyzed cells must be a positive safe integer.'));
	return issues;
}

function cellLines(ast: KaryotypeAST | null): ReviewedCellLine[] {
	if (!ast || ast.chromosome_count === null) return [];
	const lines = ast.cell_lines ?? [{ ...ast, count: ast.count ?? 0, is_donor: false }];
	return lines.map((line, index) => ({
		line: index + 1,
		label: line.raw ?? [line.chromosome_count, line.sex_chromosomes, ...line.abnormalities.map((abnormality) => abnormality.raw)].join(','),
		count: Number.isSafeInteger(line.count) && line.count > 0 ? line.count : null,
		percentage: null,
		isDonor: line.is_donor,
	}));
}

function countIssues(declared: string, total: number | null): ReviewIssue[] {
	const count = integerCount(declared);
	if (count === null) return [];
	if (total === null) return [issue('QC_COUNTS_UNAVAILABLE', 'Notation does not supply a complete set of usable metaphase counts. The declared total has not been reconciled.', 'review')];
	return count === total ? [] : [issue('QC_CELL_TOTAL', `Notation accounts for ${total} cells; the report declares ${count} analyzed cells.`)];
}

function conclusionFinding(validation: ValidationReview): boolean | null {
	const ast = validation.result.parsed;
	if (!ast || ast.chromosome_count === null) return null;
	const lines = ast.cell_lines ?? [ast];
	const known = lines.some((line) =>
		line.abnormalities.some((abnormality) => !['unknown', 'inc', 'idem', 'sl', 'sdl'].includes(abnormality.type)) ||
		(typeof line.chromosome_count === 'number' && line.chromosome_count !== 46) ||
		!['XX', 'XY', 'U'].includes(line.sex_chromosomes));
	if (known) return true;
	return validation.coverage.length || lines.some((line) => line.sex_chromosomes === 'U') ? null : false;
}

function conclusionIssues(input: ReportInput, validation: ValidationReview): ReviewIssue[] {
	if (input.conclusion === 'not-entered') return [issue('QC_CONCLUSION_MISSING', 'Select a structured conclusion to check it against the notation.', 'review')];
	const finding = conclusionFinding(validation);
	if (finding === null) return [issue('QC_CONCLUSION_UNASSESSED', 'The parsed information is insufficient to reconcile the selected conclusion. Review the source findings.', 'review')];
	const reported = input.conclusion === 'abnormality-detected';
	if (finding === reported) return [];
	return [issue('QC_CONCLUSION', finding
		? 'The notation contains an abnormal finding, but the selected conclusion says no abnormality.'
		: 'The notation describes a normal XX/XY complement, but the selected conclusion says an abnormality was detected.')];
}

function orderIssues(input: ReportInput, ast: KaryotypeAST | null): ReviewIssue[] {
	if (input.context !== 'constitutional' || !ast?.cell_lines) return [];
	const issues: ReviewIssue[] = [];
	for (const donor of [false, true]) {
		const abnormal = ast.cell_lines.filter((line) => line.is_donor === donor && !isNormalCellLine(line));
		for (let index = 1; index < abnormal.length; index++) {
			if (abnormal[index].count > abnormal[index - 1].count) {
				issues.push(issue('QC_CONSTITUTIONAL_ORDER', 'Constitutional abnormal cell lines must be listed in decreasing cell-count order within each recipient/donor group. Equal-size tie-breaks still require review.', 'error', 'ISCN 2024 §4.5.3'));
				break;
			}
		}
	}
	return issues;
}

export function reviewReport(input: ReportInput): ReportReview {
	const validation = reviewKaryotype(input.notation.length <= 5000 ? input.notation : '');
	const lines = cellLines(validation.result.parsed);
	const sum = lines.reduce((total, line) => total + (line.count ?? 0), 0);
	const totalCells = lines.length && lines.every((line) => line.count !== null) && Number.isSafeInteger(sum) && sum > 0 ? sum : null;
	if (totalCells !== null) for (const line of lines) line.percentage = (line.count ?? 0) / totalCells * 100;
	const compared = compareFindings(input.previousNotation.length <= 5000 ? input.previousNotation : '', validation.result.valid ? validation.result.parsed : null);
	const issues = [
		...inputIssues(input),
		...validation.result.errors.map((message) => issue('QC_NOTATION', message, 'error', 'ISCN 2024; implemented core rules')),
		...validation.coverage.map((note) => issue(`QC_COVERAGE_${note.code}`, note.message, 'review', 'ISCN 2024; implemented core coverage')),
		...countIssues(input.analyzedCells, totalCells),
		...conclusionIssues(input, validation),
		...orderIssues(input, validation.result.parsed),
		...compared.issues,
	];
	const status = issues.some((item) => item.severity === 'error') ? 'Issues found' : issues.length ? 'Review required' : 'Checks passed';
	return {
		inputSnapshot: { ...input },
		status, validation, issues, lines, totalCells, comparison: compared.comparison,
		checks: [
			{ name: 'Notation', outcome: validation.status },
			{ name: 'Cell totals', outcome: totalCells === null ? 'Counts unavailable or incomplete.' : `${totalCells} cells represented; percentages use this denominator across all recipient and donor lines.` },
			{ name: 'Conclusion', outcome: 'Only the structured conclusion is compared. Free-text narrative requires reviewer assessment.' },
			{ name: 'Previous/current findings', outcome: compared.comparison ? 'Literal abnormality comparison; repeated findings within a line are preserved. Clone identity, biological evolution, sex complements and counts require separate review.' : 'No comparable previous result supplied.' },
		],
	};
}
