import { notationExamples } from '#lib/examples.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		examples: Object.entries(notationExamples).map(([signature, entry]) => ({ signature, ...entry }))
	};
};
