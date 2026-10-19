import { reviewGuides } from './review-guides.js';
import { setupGuides } from './setup-guides.js';
import { evaluationGuide } from './evaluation-guide.js';
import type { Guide } from './types.js';

export const guides: Guide[] = [...reviewGuides, evaluationGuide, ...setupGuides];

export function searchGuides(query: string): Guide[] {
	const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	return guides.filter((guide) => {
		const content = JSON.stringify(guide).toLowerCase();
		return terms.every((term) => content.includes(term));
	});
}
