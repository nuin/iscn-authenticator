import { env } from 'cloudflare:workers';
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import * as db from '#lib/server/db.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/login');
	const keys = await env.DB.prepare(
		'SELECT id, label, created_at, last_used_at, revoked_at FROM api_key WHERE user_id = ? ORDER BY created_at DESC'
	)
		.bind(locals.user.id)
		.all<Pick<db.ApiKey, 'id' | 'label' | 'created_at' | 'last_used_at' | 'revoked_at'>>();

	return {
		keys: keys.results
	};
};

export const actions: Actions = {
	create: async ({ locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		
		const { record, plaintext } = await db.createKey(env.DB, locals.user.id, 'Manual key');
		return { success: true, plaintext, keyId: record.id };
	},
	revoke: async ({ request, locals }) => {
		if (!locals.user) throw redirect(302, '/login');
		
		const formData = await request.formData();
		const keyId = formData.get('key_id')?.toString();
		
		if (!keyId) return fail(400, { message: 'Missing key ID' });
		
		const now = Math.floor(Date.now() / 1000);
		await env.DB.prepare('UPDATE api_key SET revoked_at = ? WHERE id = ? AND user_id = ?')
			.bind(now, keyId, locals.user.id)
			.run();
			
		return { success: true };
	}
};
