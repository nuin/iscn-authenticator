import { env } from 'cloudflare:workers';
import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
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
