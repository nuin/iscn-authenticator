import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
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

export const actions: Actions = {
	logout: async ({ cookies, platform }) => {
		const sessionId = cookies.get('iscn_session');
		if (sessionId && platform) {
			await platform.env.DB.prepare('DELETE FROM session WHERE id = ?').bind(sessionId).run();
		}
		cookies.delete('iscn_session', { path: '/' });
		throw redirect(302, '/login');
	}
};
