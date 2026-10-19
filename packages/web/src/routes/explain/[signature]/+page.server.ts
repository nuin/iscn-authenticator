import { getCuratedSignatures } from '@iscn/core';
import { notationExamples } from '#lib/examples.js';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const signature = params.signature;
	const entry = getCuratedSignatures()[signature];

	if (!entry) {
		throw error(404, 'Not Found');
	}

	return {
		signature,
		entry,
		example: notationExamples[signature]
	};
};
