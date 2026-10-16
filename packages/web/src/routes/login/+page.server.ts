import { env } from 'cloudflare:workers';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as db from '#lib/server/db.js';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.session) {
		throw redirect(302, '/dashboard');
	}
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const apiKey = formData.get('api_key')?.toString().trim();

		if (!apiKey) {
			return fail(400, { error: 'Please provide an API key.' });
		}

		const keyRecord = await db.validateKey(env.DB, apiKey);
		if (!keyRecord || !keyRecord.user_id) {
			return fail(401, {
				error: 'This key is not valid for dashboard access (it may be revoked or internal).'
			});
		}

		const session = await db.createSession(env.DB, keyRecord.user_id);

		cookies.set('iscn_session', session.id, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: true,
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});

		throw redirect(302, '/dashboard');
	}
};
