import type { CnvCriterion, CnvDirection } from './cnv-types.ts';

export const CNV_FRAMEWORK = {
	name: 'ACMG/ClinGen constitutional CNV technical standard',
	publication: 'Riggs et al., Genetics in Medicine 22, 245–257 (2020); published online 2019-11-06',
	doi: '10.1038/s41436-019-0686-8',
	correctionDoi: '10.1038/s41436-021-01150-9',
	correction: '2021 correction: loss 5H default is 0.15; permitted range remains 0–0.30. This worksheet assigns no default score.',
	supplement: 'https://media.springernature.com/original/springer-static/esm/art%3A10.1038%2Fs41436-019-0686-8/MediaObjects/41436_2019_686_MOESM2_ESM.docx',
	url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7313390/',
	clarifications: 'https://clinicalgenome.org/tools/cnv-webinar/faq/',
	worksheetVersion: '2026-10-19.1',
	referenceChecked: '2026-10-19',
	coverage: 'Selected categories from Tables 1 (loss) and 2 (gain); other categories require an external assessment.'
};

export const CNV_SECTIONS = [
	'Genomic content', 'Dosage sensitivity and benign regions', 'Protein-coding gene number',
	'Published, laboratory and population evidence', 'Inheritance and phenotype'
];

export const CNV_LIMITATIONS = [
	'Provisional arithmetic on reviewer-supplied evidence; not a laboratory classification or report authorization.',
	'No evidence lookup, coordinate liftover, chromosome-length check, gene annotation or clinical inference is performed.',
	'Only the listed categories are supported. Partial overlap, intragenic effects, case series, segregation and de novo scoring require an external assessment.',
	'One entry per category and one category per section are accepted; these conservative worksheet limits do not replace the complete standard.',
	'Unique evidence IDs cannot prove independence. The reviewer must identify reused cases, cohorts, regions and underlying studies.',
	'The framework is pinned to the 2020 publication and 2021 correction; later evidence and laboratory policies require review.',
	'Local exports are editable records, without authenticated signatures or an immutable audit trail.'
];

const content: CnvCriterion[] = [
	{ code: '1A', label: 'Functional content present', min: 0, max: 0 },
	{ code: '1B', label: 'No known functional content', min: -60, max: -60 }
];
const population: CnvCriterion[] = [
	{ code: '4O', label: 'Population frequency evidence', min: -100, max: 0 }
];
const inheritance: CnvCriterion[] = [
	{ code: '5F', label: 'Inheritance uninformative', min: 0, max: 0 },
	{ code: '5G', label: 'Uninformative inheritance; nonspecific phenotype matches prior cases', min: 0, max: 15 },
	{ code: '5H', label: 'Uninformative inheritance; highly specific phenotype matches prior cases', min: 0, max: 30 }
];
const loss: CnvCriterion[] = [
	{ code: '2A', label: 'Full established HI gene/region overlap', min: 100, max: 100 },
	{ code: '2F', label: 'Contained in an established benign loss region', min: -100, max: -100 },
	{ code: '3A', label: '0–24 coding genes', min: 0, max: 0 },
	{ code: '3B', label: '25–34 coding genes', min: 45, max: 45 },
	{ code: '3C', label: '35+ coding genes', min: 90, max: 90 }
];
const gain: CnvCriterion[] = [
	{ code: '2A', label: 'Full established TS gene/critical-region overlap', min: 100, max: 100 },
	{ code: '2C', label: 'Gene content matches an established benign gain', min: -100, max: -100 },
	{ code: '2H', label: 'HI gene entirely within gain', min: 0, max: 0 },
	{ code: '3A', label: '0–34 coding genes', min: 0, max: 0 },
	{ code: '3B', label: '35–49 coding genes', min: 45, max: 45 },
	{ code: '3C', label: '50+ coding genes', min: 90, max: 90 }
];

export function cnvCriteria(direction: CnvDirection): CnvCriterion[] {
	return [...content, ...(direction === 'loss' ? loss : gain), ...population, ...inheritance];
}

export function cnvGeneCategory(direction: CnvDirection, count: number): string {
	const [moderate, high] = direction === 'loss' ? [25, 35] : [35, 50];
	if (count >= high) return '3C';
	return count >= moderate ? '3B' : '3A';
}
