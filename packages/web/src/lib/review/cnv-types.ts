export type CnvDirection = 'loss' | 'gain';
export type CnvClassification = 'Pathogenic' | 'Likely pathogenic' | 'Uncertain significance' | 'Likely benign' | 'Benign';

export interface CnvEvidence {
	criterion: string;
	score: string;
	evidenceId: string;
	citation: string;
	rationale: string;
}

export interface CnvSectionReview {
	section: number;
	reviewed: boolean;
	note: string;
}

export interface CnvInput {
	chromosome: string;
	start: string;
	end: string;
	assembly: string;
	direction: CnvDirection;
	geneCount: string;
	reviewer: string;
	assessmentDate: string;
	evidence: CnvEvidence[];
	sectionReviews: CnvSectionReview[];
	constitutionalConfirmed: boolean;
	supportedOnly: boolean;
	independenceConfirmed: boolean;
	populationCaveatsReviewed: boolean;
	conflictRationale: string;
	patientInterpretation: string;
}

export interface CnvIssue { code: string; message: string }

export interface CnvResult {
	status: 'incomplete' | 'provisional';
	score: number | null;
	provisionalClassification: CnvClassification | null;
	issues: CnvIssue[];
	limitations: string[];
}

export interface CnvCriterion {
	code: string;
	label: string;
	min: number;
	max: number;
}
