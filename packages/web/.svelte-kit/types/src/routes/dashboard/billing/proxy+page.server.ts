// @ts-nocheck
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load = async ({ locals }: Parameters<PageServerLoad>[0]) => {
	// User session verified in +layout.server.ts
	return {};
};

export const actions = {
	upgrade: async ({ locals, platform }: import('./$types').RequestEvent) => {
		if (!locals.user || !platform) throw redirect(302, '/login');
		return {
			message: 'Stripe integration is pending environment variables configuration.'
		};
	},
	manage: async ({ locals, platform }: import('./$types').RequestEvent) => {
		if (!locals.user || !platform) throw redirect(302, '/login');
		return {
			message: 'Stripe integration is pending environment variables configuration.'
		};
	}
};
;null as any as Actions;