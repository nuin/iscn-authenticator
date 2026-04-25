// @ts-nocheck
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as db from '$lib/server/db';

export const load = async ({ locals }: Parameters<PageServerLoad>[0]) => {
	if (locals.session) {
		throw redirect(302, '/dashboard');
	}
};

export const actions = {
	default: async ({ request, platform, cookies }: import('./$types').RequestEvent) => {
		if (!platform) {
			return fail(500, { message: 'Platform not available' });
		}

		const formData = await request.formData();
		const apiKey = formData.get('api_key')?.toString().trim();

		if (!apiKey) {
			return fail(400, { error: 'Please provide an API key.' });
		}

		const keyRecord = await db.validateKey(platform.env.DB, apiKey);
		if (!keyRecord || !keyRecord.user_id) {
			return fail(401, {
				error: 'This key is not valid for dashboard access (it may be revoked or internal).'
			});
		}

		const session = await db.createSession(platform.env.DB, keyRecord.user_id);

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
;null as any as Actions;