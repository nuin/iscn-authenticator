export const notationExamples: Record<string, { title: string; category: string; description: string; full: string }> = {
	'47,XX,+21': { title: 'An extra chromosome 21', category: 'Numerical change', description: 'The count is 47, the sex chromosome notation is XX, and +21 denotes an additional chromosome 21.', full: '47,XX,+21' },
	'47,XY,+21': { title: 'An extra chromosome 21', category: 'Numerical change', description: 'The count is 47, the sex chromosome notation is XY, and +21 denotes an additional chromosome 21.', full: '47,XY,+21' },
	'45,X': { title: 'A single X chromosome', category: 'Chromosome count', description: 'The count is 45 and the sex chromosome notation contains a single X. No separate abnormality is listed in this string.', full: '45,X' },
	'47,XXY': { title: 'XXY sex chromosome notation', category: 'Chromosome count', description: 'The count is 47 and the sex chromosome notation is XXY. Inspect the count and parsed sex chromosome field in the workspace.', full: '47,XXY' },
	't(9;22)(q34;q11.2)': { title: 'A translocation between 9 and 22', category: 'Structural change', description: 'The t symbol describes a translocation. The two chromosome entries correspond to the two breakpoint entries: 9q34 and 22q11.2.', full: '46,XX,t(9;22)(q34;q11.2)' },
	'del(5)(p15)': { title: 'A deletion on chromosome 5', category: 'Structural change', description: 'The del symbol describes a deletion. The chromosome field is 5 and the listed breakpoint is p15 on its short arm.', full: '46,XX,del(5)(p15)' }
};
