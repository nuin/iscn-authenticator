import { env } from 'cloudflare:workers';
import type { Handle } from '@sveltejs/kit/hooks';
import * as db from '#lib/server/db.js';

export const handle: Handle = async ({ event, resolve }) => {
  const response = await handleSession({ event, resolve });
  if (['/login', '/signup', '/recover'].includes(event.url.pathname) || event.url.pathname.startsWith('/dashboard')) {
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'same-origin');
  }
  return response;
};

const handleSession: Handle = async ({ event, resolve }) => {
  event.locals.session = null;
  event.locals.user = null;
  if (event.url.pathname.startsWith('/api/v1/')) return resolve(event);
  const sessionId = event.cookies.get('iscn_session');
  if (sessionId) {
    const authenticated = await db.authenticateSession(env.DB, sessionId);
    if (authenticated) {
      event.locals.session = authenticated.session;
      event.locals.user = authenticated.user;
    } else {
      event.cookies.delete('iscn_session', { path: '/' });
    }
  }
  return resolve(event);
};
