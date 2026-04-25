// @ts-nocheck
import curatedData from '@iscn/core/data/explains/curated.json' with { type: 'json' };
import type { PageServerLoad } from './$types';

export const load = async () => {
	return {
		signatures: Object.keys(curatedData.signatures)
	};
};
;null as any as PageServerLoad;