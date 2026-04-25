import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// User session verified in +layout.server.ts
	return {};
};

export const actions: Actions = {
	upgrade: async ({ locals, platform }) => {
		if (!locals.user || !platform) throw redirect(302, '/login');
		return {
			message: 'Stripe integration is pending environment variables configuration.'
		};
	},
	manage: async ({ locals, platform }) => {
		if (!locals.user || !platform) throw redirect(302, '/login');
		return {
			message: 'Stripe integration is pending environment variables configuration.'
		};
	}
};
