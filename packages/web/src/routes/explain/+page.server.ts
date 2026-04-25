import curatedData from '@iscn/core/data/explains/curated.json' with { type: 'json' };
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		signatures: Object.keys(curatedData.signatures)
	};
};
