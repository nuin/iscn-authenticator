// @ts-nocheck
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load = async ({ locals, platform }: Parameters<PageServerLoad>[0]) => {
	// User session is verified in +layout.server.ts
	
	// Fetch usage stats
	const now = new Date();
	const month = now.getUTCFullYear().toString() + (now.getUTCMonth() + 1).toString().padStart(2, '0');

	const used = 0;
	const limit = locals.user!.plan === 'pro' ? 100000 : 1000;

	return {
		usage: {
			used,
			limit,
			remaining: Math.max(0, limit - used),
			month
		}
	};
};

export const actions = {
	logout: async ({ cookies, platform }: import('./$types').RequestEvent) => {
		const sessionId = cookies.get('iscn_session');
		if (sessionId && platform) {
			await platform.env.DB.prepare('DELETE FROM session WHERE id = ?').bind(sessionId).run();
		}
		cookies.delete('iscn_session', { path: '/' });
		throw redirect(302, '/login');
	}
};
;null as any as Actions;