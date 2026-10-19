import { error } from '@sveltejs/kit';
import { guides } from '#lib/docs/index.js';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const guide = guides.find((entry) => entry.slug === params.slug);
	if (!guide) error(404, 'Guide not found');
	return { guide };
};
