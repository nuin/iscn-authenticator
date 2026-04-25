import type { Handle } from '@sveltejs/kit';
import * as db from '$lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('iscn_session');

	if (!sessionId || !event.platform) {
		event.locals.session = null;
		event.locals.user = null;
		return await resolve(event);
	}

	const session = await db.validateSession(event.platform.env.DB, sessionId);

	if (!session) {
		event.cookies.delete('iscn_session', { path: '/' });
		event.locals.session = null;
		event.locals.user = null;
		return await resolve(event);
	}

	const user = await event.platform.env.DB.prepare('SELECT * FROM user WHERE id = ?')
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
