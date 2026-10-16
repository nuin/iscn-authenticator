import { env } from 'cloudflare:workers';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as db from '#lib/server/db.js';

export const load: PageServerLoad = async ({ locals }) => {
	// If already logged in, redirect to dashboard
	if (locals.session) {
		throw redirect(302, '/dashboard');
	}
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString().trim();

		if (!email) {
			return fail(400, { email, error: 'Email is required' });
		}

		if (!isPlausibleEmail(email)) {
			return fail(400, { email, error: 'Invalid email address' });
		}

		const existing = await db.getUserByEmail(env.DB, email);
		if (existing) {
			return fail(400, { email, error: 'Email already registered' });
		}

		const user = await db.createUser(env.DB, email);

		const { record: keyRecord, plaintext } = await db.createKey(env.DB, user.id, 'Initial key');

		const session = await db.createSession(env.DB, user.id);

		// Set session cookie
		cookies.set('iscn_session', session.id, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: true, // Pages is always HTTPS
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});

		return {
			success: true,
			email: user.email,
			plaintext,
			keyId: keyRecord.id
		};
	}
};

function isPlausibleEmail(email: string): boolean {
	return email.includes('@') && email.includes('.') && email.length > 5;
}
