// @ts-nocheck
import curatedData from '@iscn/core/data/explains/curated.json' with { type: 'json' };
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load = async ({ params }: Parameters<PageServerLoad>[0]) => {
	const signature = params.signature;
	const entry = (curatedData.signatures as any)[signature];

	if (!entry) {
		throw error(404, 'Not Found');
	}

	return {
		signature,
		entry
	};
};
