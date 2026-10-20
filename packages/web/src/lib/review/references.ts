export const REVIEW_RULE_VERSION = '2026-10-19';

export const REVIEW_REFERENCES = [
	{ id: 'iscn-2024', title: 'ISCN 2024', url: 'https://doi.org/10.1159/000538512', scope: 'Notation: general rules, cell lines (§4.5.3), clone references (§6.3.4), and interphase FISH (§7.3.1).' },
	{ id: 'iscn-erratum-549238', title: 'ISCN 2024 erratum, December 2025', url: 'https://doi.org/10.1159/000549238', scope: 'Corrections relevant to chromosome totals and related clones; the reference register records implementation limits.' },
	{ id: 'laboratory-qc', title: 'Laboratory review rules', url: '/docs/report-review', scope: 'Application checks for declared totals, structured conclusions and literal finding comparisons; these are not additional ISCN rules.' },
	{ id: 'ucsc-hg38', title: 'UCSC hg38 cytoband reference', url: 'https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/cytoBand.txt.gz', scope: 'Bundled chromosome bands support catalogue consistency checks, with resolution limits documented separately.' },
];

export function integerCount(value: string, allowZero = false): number | null {
	if (!/^\d+$/.test(value.trim())) return null;
	const number = Number(value.trim());
	return Number.isSafeInteger(number) && number >= (allowZero ? 0 : 1) ? number : null;
}
