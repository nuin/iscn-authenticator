import { env } from 'cloudflare:workers';
import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { CODE_LIFETIME, readChallenge, requestCode, type EmailPurpose } from './challenges.ts';
import { EmailAuthError } from './limits.ts';
import { verifyCode } from './verify.ts';
import { digest } from './crypto.ts';

const CHALLENGE_COOKIE = 'iscn_email_challenge';
const COOKIE_OPTIONS = { path: '/', secure: true, httpOnly: true, sameSite: 'lax' as const };
type AuthEvent = Pick<RequestEvent, 'request' | 'cookies' | 'getClientAddress' | 'locals'>;

async function readForm(request: Request): Promise<FormData> {
  const reader = request.body?.getReader();
  if (!reader) throw new EmailAuthError(400, 'Complete the form and try again.');
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      throw new EmailAuthError(413, 'The submitted form is too large.');
    }
    chunks.push(new Uint8Array(value));
  }
  try { return await new Response(new Blob(chunks), { headers: request.headers }).formData(); }
  catch { throw new EmailAuthError(400, 'Complete the form and try again.'); }
}

function reject(error: unknown) {
  if (error instanceof EmailAuthError) return fail(error.status, { error: error.message });
  console.error(JSON.stringify({ event: 'email_auth_failed', request_id: crypto.randomUUID() }));
  return fail(503, { error: 'Account access is temporarily unavailable. Please try again later.' });
}

export function emailActions(purpose: EmailPurpose) {
  return {
    change: async ({ cookies }: AuthEvent) => {
      const token = cookies.get(CHALLENGE_COOKIE);
      if (token) await env.DB.prepare('DELETE FROM email_challenge WHERE id = ?').bind(await digest(token)).run();
      cookies.delete(CHALLENGE_COOKIE, { path: '/' });
      return { reset: true };
    },
    request: async ({ request, cookies, getClientAddress }: AuthEvent) => {
      try {
        const form = await readForm(request);
        const pending = await requestCode(env.DB, env.MAILER, {
          email: String(form.get('email') ?? ''), purpose, ip: getClientAddress(), url: request.url,
          previous: cookies.get(CHALLENGE_COOKIE), secret: env.EMAIL_AUTH_SECRET,
        });
        cookies.set(CHALLENGE_COOKIE, pending.token, { ...COOKIE_OPTIONS, maxAge: CODE_LIFETIME });
        return { sent: true, email: pending.email };
      } catch (error) { return reject(error); }
    },
    verify: async ({ request, cookies }: AuthEvent) => {
      try {
        const form = await readForm(request);
        const session = await verifyCode(env.DB, cookies.get(CHALLENGE_COOKIE) ?? '', String(form.get('code') ?? ''), purpose, env.EMAIL_AUTH_SECRET);
        cookies.set('iscn_session', session.id, { ...COOKIE_OPTIONS, maxAge: 30 * 86400 });
        cookies.delete(CHALLENGE_COOKIE, { path: '/' });
      } catch (error) { return reject(error); }
      return redirect(303, '/dashboard');
    },
  };
}

export async function loadEmailPage(event: Pick<RequestEvent, 'locals' | 'cookies'>, purpose: EmailPurpose) {
  if (event.locals.session && purpose !== 'recover') redirect(302, '/dashboard');
  return { pending: await readChallenge(env.DB, event.cookies.get(CHALLENGE_COOKIE), purpose) };
}
