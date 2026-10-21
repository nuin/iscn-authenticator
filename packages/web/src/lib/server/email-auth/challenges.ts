import { codeDigest, digest, randomCode, randomToken } from './crypto.ts';
import { EmailAuthError, reserveEmail } from './limits.ts';

export type EmailPurpose = 'signup' | 'login' | 'recover';
export const CODE_LIFETIME = 600;
export interface Challenge { email: string; purpose: EmailPurpose; expires_at: number }

export function normalizeEmail(input: string): string {
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email)) {
    throw new EmailAuthError(400, 'Enter a valid email address.');
  }
  return email;
}

export async function requestCode(
  db: D1Database, mailer: Fetcher, input: { email: string; purpose: EmailPurpose; ip: string; url: string; previous?: string; secret?: string },
  now = Math.floor(Date.now() / 1000),
): Promise<{ token: string; email: string }> {
  const email = normalizeEmail(input.email);
  const token = randomToken();
  const code = randomCode();
  const codeHash = await codeDigest(input.secret, token, code);
  await reserveEmail(db, email, input.ip, now);
  const id = await digest(token);
  await db.batch([
    db.prepare('DELETE FROM email_challenge WHERE id IN (SELECT id FROM email_challenge WHERE expires_at <= ? LIMIT 100)').bind(now),
    db.prepare('DELETE FROM email_auth_limit WHERE id IN (SELECT id FROM email_auth_limit WHERE resets_at <= ? LIMIT 100)').bind(now),
    db.prepare('INSERT INTO email_challenge (id, email, purpose, code_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, email, input.purpose, codeHash, now, now + CODE_LIFETIME),
  ]);
  try {
    const response = await mailer.fetch(new URL('/send', input.url), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(codeMessage(email, code, input.purpose)), signal: AbortSignal.timeout(15_000),
    });
    if (response.status !== 202) throw new EmailAuthError(503, 'Email delivery is unavailable. Please try again later.');
    await db.prepare('UPDATE email_challenge SET sent = 1 WHERE id = ?').bind(id).run();
  } catch {
    await db.prepare('DELETE FROM email_challenge WHERE id = ?').bind(id).run();
    throw new EmailAuthError(503, 'Email delivery is unavailable. Please try again later.');
  }
  if (input.previous) await db.prepare('DELETE FROM email_challenge WHERE id = ?').bind(await digest(input.previous)).run();
  return { token, email };
}

function codeMessage(to: string, code: string, purpose: EmailPurpose) {
  const labels = { signup: 'verify your email', login: 'sign in', recover: 'recover your account' };
  const action = labels[purpose];
  return {
    to, subject: `Your ISCN code to ${action}`,
    text: `Use this code to ${action} at Bioinformat ISCN:\n\n${code}\n\nIt expires in 10 minutes. Enter it in the browser where you requested it. Never share this code; our team will never ask for it.\n\n${purpose === 'recover' ? 'Recovery signs out other browser sessions. For previously verified accounts, your subscription and existing API integrations are preserved.\n\n' : ''}If you did not request this code, ignore this email. No account access is granted without the code.`,
  };
}

export async function readChallenge(db: D1Database, token: string | undefined, purpose: EmailPurpose, now = Math.floor(Date.now() / 1000)): Promise<Challenge | null> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db.prepare(`SELECT email, purpose, expires_at FROM email_challenge
    WHERE id = ? AND purpose = ? AND sent = 1 AND claim IS NULL AND attempts < 5 AND expires_at > ?`)
    .bind(await digest(token), purpose, now).first<Challenge>();
}
