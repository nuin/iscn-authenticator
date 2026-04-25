// @ts-nocheck
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import * as db from '$lib/server/db';

export const load = async ({ locals, platform }: Parameters<PageServerLoad>[0]) => {
	// User session verified in +layout.server.ts
	if (!platform) return { keys: [] };

	const keys = await platform.env.DB.prepare('SELECT * FROM api_key WHERE user_id = ? ORDER BY created_at DESC')
		.bind(locals.user!.id)
		.all<db.ApiKey>();

	return {
		keys: keys.results
	};
};

export const actions = {
	create: async ({ locals, platform }: import('./$types').RequestEvent) => {
		if (!locals.user || !platform) throw redirect(302, '/login');
		
		const { record, plaintext } = await db.createKey(platform.env.DB, locals.user.id, 'Manual key');
		return { success: true, plaintext, keyId: record.id };
	},
	revoke: async ({ request, locals, platform }: import('./$types').RequestEvent) => {
		if (!locals.user || !platform) throw redirect(302, '/login');
		
		const formData = await request.formData();
		const keyId = formData.get('key_id')?.toString();
		
		if (!keyId) return fail(400, { message: 'Missing key ID' });
		
		const now = Math.floor(Date.now() / 1000);
		await platform.env.DB.prepare('UPDATE api_key SET revoked_at = ? WHERE id = ? AND user_id = ?')
			.bind(now, keyId, locals.user.id)
			.run();
			
		return { success: true };
	}
};
;null as any as Actions;