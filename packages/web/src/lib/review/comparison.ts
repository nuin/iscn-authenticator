import type { Abnormality, KaryotypeAST } from '@iscn/core';
import { reviewKaryotype } from '../validation.ts';
import type { FindingComparison, ReviewIssue } from './types.ts';

function normalizedFinding(abnormality: Abnormality): string {
	return abnormality.raw.trim().replaceAll('×', 'x').replace(/[−–]/g, '-');
}

function findings(ast: KaryotypeAST): string[] {
	const lines = ast.cell_lines ?? [ast];
	const maximum = new Map<string, number>();
	for (const line of lines) {
		const counts = new Map<string, number>();
		for (const abnormality of line.abnormalities) {
			const finding = normalizedFinding(abnormality);
			counts.set(finding, (counts.get(finding) ?? 0) + 1);
		}
		for (const [finding, count] of counts) maximum.set(finding, Math.max(count, maximum.get(finding) ?? 0));
	}
	return [...maximum].flatMap(([finding, count]) => Array<string>(count).fill(finding));
}

export function compareFindings(previousNotation: string, current: KaryotypeAST | null): { comparison: FindingComparison | null; issues: ReviewIssue[] } {
	if (!previousNotation.trim()) return { comparison: null, issues: [] };
	const prior = reviewKaryotype(previousNotation);
	if (!prior.result.valid || !prior.result.parsed || !current) {
		return { comparison: null, issues: [{ code: 'QC_PREVIOUS_NOTATION', severity: 'review', message: 'The previous and current notation must both pass the implemented checks before findings can be compared.', reference: 'Laboratory QC rule 2026-10-19' }] };
	}
	const remaining = findings(prior.result.parsed);
	const added: string[] = [];
	const retained: string[] = [];
	for (const finding of findings(current)) {
		const index = remaining.indexOf(finding);
		if (index < 0) added.push(finding);
		else {
			retained.push(finding);
			remaining.splice(index, 1);
		}
	}
	const issues: ReviewIssue[] = prior.coverage.length ? [{ code: 'QC_PREVIOUS_COVERAGE', severity: 'review', message: 'The previous notation has partial coverage. The comparison uses literal parsed findings and requires manual reconciliation.', reference: 'Laboratory QC rule 2026-10-19' }] : [];
	return { comparison: { added, removed: remaining, retained, previousStatus: prior.status }, issues };
}
