import { env } from 'cloudflare:workers';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { ApiKey } from '#lib/server/db.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	const keys = await env.DB.prepare('SELECT id, revoked_at FROM api_key WHERE user_id = ?')
		.bind(locals.user.id)
		.all<Pick<ApiKey, 'id' | 'revoked_at'>>();

	return {
		keys: keys.results,
		activeKeyCount: keys.results.filter((key) => key.revoked_at === null).length
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
