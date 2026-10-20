import { cnvCriteria, cnvGeneCategory, CNV_FRAMEWORK, CNV_LIMITATIONS } from './cnv-criteria.ts';
import type { CnvClassification, CnvEvidence, CnvInput, CnvIssue, CnvResult } from './cnv-types.ts';

export type { CnvInput, CnvResult } from './cnv-types.ts';

function integer(value: string, minimum: number): number | null {
	if (!/^\d+$/.test(value)) return null;
	const number = Number(value);
	return Number.isSafeInteger(number) && number >= minimum ? number : null;
}

function points(value: string): number | null {
	if (!/^-?\d+(?:\.\d{1,2})?$/.test(value)) return null;
	const amount = Math.round(Number(value) * 100);
	return Number.isSafeInteger(amount) ? amount : null;
}

function identityIssues(input: CnvInput): CnvIssue[] {
	const start = integer(input.start, 1);
	const end = integer(input.end, 1);
	if (!/^(?:[1-9]|1\d|2[0-2]|X|Y)$/.test(input.chromosome)
		|| !['GRCh37', 'GRCh38'].includes(input.assembly) || !['loss', 'gain'].includes(input.direction)
		|| start === null || end === null || end < start || integer(input.geneCount, 0) === null) {
		return [{ code: 'identity', message: 'Provide chromosome 1–22/X/Y, GRCh37/GRCh38, gain/loss, positive integer coordinates (end ≥ start), and a nonnegative integer gene count.' }];
	}
	return [];
}

function assessmentIssues(input: CnvInput): CnvIssue[] {
	const issues: CnvIssue[] = [];
	if (!input.reviewer.trim()) issues.push({ code: 'reviewer', message: 'Enter the reviewer name.' });
	const date = new Date(`${input.assessmentDate}T00:00:00Z`);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(input.assessmentDate) || !Number.isFinite(date.getTime())
		|| date.toISOString().slice(0, 10) !== input.assessmentDate) {
		issues.push({ code: 'assessment-date', message: 'Enter a valid assessment date (YYYY-MM-DD).' });
	}
	for (let section = 1; section <= 5; section++) {
		const records = input.sectionReviews.filter(entry => entry.section === section);
		if (records.length !== 1 || records[0].reviewed !== true || !records[0].note.trim()) {
			issues.push({ code: 'section-review', message: `Review section ${section} and record the sources considered, exclusions or reason for skipping it.` });
		}
	}
	if (input.constitutionalConfirmed !== true) issues.push({ code: 'scope', message: 'Confirm a constitutional CNV with validated detection that meets your laboratory reporting criteria.' });
	if (input.supportedOnly !== true) issues.push({ code: 'unsupported-evidence', message: 'An assessment requiring omitted categories must be completed outside this worksheet.' });
	if (input.independenceConfirmed !== true) issues.push({ code: 'independence', message: 'Review independence of the underlying evidence before calculating.' });
	return issues;
}

function evidenceIssues(input: CnvInput): CnvIssue[] {
	const issues: CnvIssue[] = [];
	const criteria = cnvCriteria(input.direction);
	const categories = new Set<string>();
	const units = new Set<string>();
	const sections = new Set<string>();
	for (const [index, entry] of input.evidence.entries()) {
		const prefix = `Evidence ${index + 1}`;
		const criterion = criteria.find(candidate => candidate.code === entry.criterion);
		const amount = points(entry.score);
		if (!criterion) issues.push({ code: 'unsupported-category', message: `${prefix}: category is not supported for this direction.` });
		else if (amount === null || amount < criterion.min || amount > criterion.max) {
			issues.push({ code: 'score-range', message: `${prefix}: ${criterion.code} requires ${criterion.min / 100} to ${criterion.max / 100} points, with at most two decimal places.` });
		}
		if (![entry.citation, entry.rationale, entry.evidenceId].every(value => value.trim())) {
			issues.push({ code: 'evidence-provenance', message: `${prefix}: add a citation, rationale and non-identifying evidence-unit ID.` });
		}
		if (categories.has(entry.criterion)) issues.push({ code: 'duplicate-category', message: `${prefix}: do not repeat ${entry.criterion}; document the aggregate assessment in one entry.` });
		else if (sections.has(entry.criterion[0])) issues.push({ code: 'exclusive-category', message: `${prefix}: this worksheet accepts one category per section. More complex combinations require an external assessment.` });
		const unit = entry.evidenceId.trim().toLowerCase();
		if (units.has(unit)) issues.push({ code: 'duplicate-evidence', message: `${prefix}: an evidence-unit ID is reused. Do not score the same underlying evidence twice.` });
		categories.add(entry.criterion);
		sections.add(entry.criterion[0]);
		units.add(unit);
	}
	return issues;
}

function categoryIssues(input: CnvInput): CnvIssue[] {
	const issues: CnvIssue[] = [];
	const codes = input.evidence.map(entry => entry.criterion);
	for (const section of ['1', '3', '5']) {
		if (!codes.some(code => code.startsWith(section))) issues.push({ code: 'required-category', message: `Select a supported category for section ${section}; a blank section is not zero evidence.` });
	}
	const geneCount = integer(input.geneCount, 0);
	if (geneCount !== null && !codes.includes(cnvGeneCategory(input.direction, geneCount))) {
		issues.push({ code: 'gene-count-category', message: 'The section 3 category does not match the assessed gene count and gain/loss direction.' });
	}
	if (codes.includes('1B') && ((geneCount !== null && geneCount > 0) || codes.includes('2A') || (input.direction === 'gain' && codes.includes('2H')))) {
		issues.push({ code: 'content-conflict', message: 'No functional content conflicts with the entered gene count or dosage-sensitive content.' });
	}
	if (input.direction === 'loss' && codes.includes('2A') && codes.some(code => code.startsWith('4'))) {
		issues.push({ code: 'section-routing', message: 'The loss metric directs established HI overlap in section 2 to skip section 4. Resolve the assessment externally if conflicting population evidence exists.' });
	}
	if (codes.includes('4O') && input.populationCaveatsReviewed !== true) {
		issues.push({ code: 'population-caveats', message: 'Review population dosage/gene-content matching, carrier status and dataset limitations before using 4O.' });
	}
	const amounts = input.evidence.map(entry => points(entry.score));
	if (amounts.some(value => value !== null && value > 0) && amounts.some(value => value !== null && value < 0) && !input.conflictRationale.trim()) {
		issues.push({ code: 'conflicting-evidence', message: 'Positive and negative evidence coexist. Document how the conflict and evidence independence were reviewed.' });
	}
	return issues;
}

function classification(hundredths: number): CnvClassification {
	if (hundredths >= 99) return 'Pathogenic';
	if (hundredths >= 90) return 'Likely pathogenic';
	if (hundredths <= -99) return 'Benign';
	if (hundredths <= -90) return 'Likely benign';
	return 'Uncertain significance';
}

function sumPoints(evidence: CnvEvidence[]): number {
	return evidence.reduce((sum, entry) => {
		const amount = points(entry.score);
		if (amount === null) throw new Error('Cannot sum unvalidated CNV evidence.');
		return sum + amount;
	}, 0);
}

export function assessCnv(input: CnvInput): CnvResult {
	const issues = [...identityIssues(input), ...assessmentIssues(input), ...evidenceIssues(input), ...categoryIssues(input)];
	if (issues.length) return { status: 'incomplete', score: null, provisionalClassification: null, issues, limitations: [...CNV_LIMITATIONS] };
	const total = sumPoints(input.evidence);
	return { status: 'provisional', score: total / 100, provisionalClassification: classification(total), issues, limitations: [...CNV_LIMITATIONS] };
}

export function createCnvRecord(input: CnvInput, timestamp: string) {
	const date = new Date(timestamp);
	if (!Number.isFinite(date.getTime())) throw new Error('A valid export timestamp is required.');
	const snapshot = structuredClone(input);
	return {
		schemaVersion: 'iscn.cnv-evidence.v1', exportedAt: date.toISOString(), authenticated: false,
		coordinateConvention: '1-based inclusive', framework: { ...CNV_FRAMEWORK }, input: snapshot, result: assessCnv(snapshot)
	};
}
