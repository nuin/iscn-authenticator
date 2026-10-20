import type { ValidationReview, ReviewStatus } from '../validation.ts';

export type SpecimenContext = 'unspecified' | 'constitutional' | 'neoplastic';
export type ReportConclusion = 'not-entered' | 'no-abnormality' | 'abnormality-detected';

export interface ReportInput {
	notation: string;
	previousNotation: string;
	analyzedCells: string;
	context: SpecimenContext;
	conclusion: ReportConclusion;
	reportText: string;
}

export interface ReviewIssue {
	code: string;
	severity: 'error' | 'review';
	message: string;
	reference: string;
}

export interface ReviewedCellLine {
	line: number;
	label: string;
	count: number | null;
	percentage: number | null;
	isDonor: boolean;
}

export interface FindingComparison {
	added: string[];
	removed: string[];
	retained: string[];
	previousStatus: ReviewStatus;
}

export interface ReportReview {
	inputSnapshot: ReportInput;
	status: ReviewStatus;
	validation: ValidationReview;
	issues: ReviewIssue[];
	lines: ReviewedCellLine[];
	totalCells: number | null;
	comparison: FindingComparison | null;
	checks: { name: string; outcome: string }[];
}

export interface FishInput {
	probes: { name: string; signals: string }[];
	countMode: 'mixed' | 'all-observed' | 'constitutional-nonmosaic';
	observedNuclei: string;
	totalNuclei: string;
	cutoffPercent: string;
	cutoffOperator: '>' | '>=';
	protocol: string;
}

export interface FishReview {
	inputSnapshot: FishInput;
	notation: string | null;
	percentage: number | null;
	threshold: 'meets' | 'does-not-meet' | 'not-assessed';
	issues: ReviewIssue[];
}

export interface ReviewSignoff {
	reviewer: string;
	disposition: 'reviewed' | 'follow-up';
	rationale: string;
	acknowledgedLimits: boolean;
}

export interface ReviewRecord {
	schema: 'iscn.review-record.v1';
	createdAt: string;
	ruleVersion: string;
	references: { id: string; title: string; url: string; scope: string }[];
	input: ReportInput;
	review: ReportReview;
	signoff: ReviewSignoff;
	recordType: 'local-self-attested-review';
}
