import { spreadsheetCell } from '../csv.ts';
import { reviewReport } from './report.ts';
import { buildFish } from './fish.ts';
import { REVIEW_REFERENCES, REVIEW_RULE_VERSION } from './references.ts';
import type { FishInput, FishReview, ReportInput, ReportReview, ReviewRecord, ReviewSignoff } from './types.ts';

function checkSignoff(signoff: ReviewSignoff, review: ReportReview): void {
	if (!signoff.reviewer.trim() || !signoff.rationale.trim()) throw new Error('Enter the reviewer name and review rationale.');
	if (signoff.reviewer.length > 200 || signoff.rationale.length > 10000) throw new Error('Limit the reviewer name to 200 characters and rationale to 10,000 characters.');
	if (!signoff.acknowledgedLimits) throw new Error('Acknowledge the coverage limits and the nature of this local review record.');
	if (!['reviewed', 'follow-up'].includes(signoff.disposition)) throw new Error('Choose a review disposition.');
	if (signoff.disposition === 'reviewed' && review.status === 'Issues found') throw new Error('Unresolved issues require the follow-up disposition.');
}

export function createReviewRecord(input: ReportInput, review: ReportReview, signoff: ReviewSignoff, timestamp = new Date().toISOString()): ReviewRecord {
	const current = reviewReport(input);
	if (JSON.stringify(current) !== JSON.stringify(review)) throw new Error('Inputs changed after review. Run the checks again before exporting a record.');
	checkSignoff(signoff, current);
	if (!/^\d{4}-\d{2}-\d{2}T/.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) throw new Error('A valid ISO review timestamp is required.');
	return structuredClone({
		schema: 'iscn.review-record.v1', createdAt: timestamp, ruleVersion: REVIEW_RULE_VERSION,
		references: REVIEW_REFERENCES, input, review: current, signoff, recordType: 'local-self-attested-review',
	});
}

export function reviewRecordCSV(record: ReviewRecord): string {
	const { input, review, signoff } = record;
	const rows = [
		['Schema', 'Created', 'Rule version', 'Reviewer', 'Disposition', 'Rationale', 'Status', 'Notation', 'Previous notation', 'Context', 'Declared cells', 'Represented cells', 'Conclusion', 'Narrative', 'Issues', 'Cell lines', 'Finding comparison', 'References', 'Record type', 'Scope acknowledged', 'Checks', 'Validation', 'Issue details'],
		[record.schema, record.createdAt, record.ruleVersion, signoff.reviewer, signoff.disposition, signoff.rationale, review.status,
			input.notation, input.previousNotation, input.context, input.analyzedCells, String(review.totalCells ?? ''), input.conclusion, input.reportText,
			review.issues.map((item) => `${item.code}: ${item.message}`).join('\n'), JSON.stringify(review.lines), JSON.stringify(review.comparison), JSON.stringify(record.references),
			record.recordType, String(signoff.acknowledgedLimits), JSON.stringify(review.checks), JSON.stringify(review.validation), JSON.stringify(review.issues)],
	];
	return rows.map((row) => row.map(spreadsheetCell).join(',')).join('\r\n');
}

export function createFishRecord(input: FishInput, review: FishReview, timestamp = new Date().toISOString()) {
	const current = buildFish(input);
	if (JSON.stringify(current) !== JSON.stringify(review)) throw new Error('Inputs changed after construction. Build the notation again before exporting.');
	if (!current.notation || current.issues.length) throw new Error('Resolve the FISH input issues before exporting a worksheet.');
	if (!/^\d{4}-\d{2}-\d{2}T/.test(timestamp) || !Number.isFinite(Date.parse(timestamp))) throw new Error('A valid ISO worksheet timestamp is required.');
	return structuredClone({
		schema: 'iscn.fish-worksheet.v1', createdAt: timestamp, ruleVersion: REVIEW_RULE_VERSION,
		references: REVIEW_REFERENCES.filter((reference) => reference.id !== 'ucsc-hg38'), input, review: current,
		scope: 'One hybridization and a user-supplied signal pattern; no probe-order verification, clinical interpretation or authenticated review.',
	});
}
