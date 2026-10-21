import { env } from 'cloudflare:workers';
import type { Handle } from '@sveltejs/kit/hooks';
import * as db from '#lib/server/db.js';

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api/v1/')) {
		event.locals.session = null;
		event.locals.user = null;
		return resolve(event);
	}
	const sessionId = event.cookies.get('iscn_session');

	if (!sessionId) {
		event.locals.session = null;
		event.locals.user = null;
		return await resolve(event);
	}

	const session = await db.validateSession(env.DB, sessionId);

	if (!session) {
		event.cookies.delete('iscn_session', { path: '/' });
		event.locals.session = null;
		event.locals.user = null;
		return await resolve(event);
	}

	const user = await env.DB.prepare('SELECT * FROM user WHERE id = ?')
		.bind(session.user_id)
		.first<db.User>();

	if (!user) {
		event.cookies.delete('iscn_session', { path: '/' });
		event.locals.session = null;
		event.locals.user = null;
		return await resolve(event);
	}

	event.locals.session = session;
	event.locals.user = user;

	return await resolve(event);
};
