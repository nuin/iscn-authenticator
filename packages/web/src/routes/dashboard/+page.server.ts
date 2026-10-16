import { env } from 'cloudflare:workers';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// User session is verified in +layout.server.ts
	
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
	logout: async ({ cookies }) => {
		const sessionId = cookies.get('iscn_session');
		if (sessionId) {
			await env.DB.prepare('DELETE FROM session WHERE id = ?').bind(sessionId).run();
		}
		cookies.delete('iscn_session', { path: '/' });
		throw redirect(302, '/login');
	}
};
