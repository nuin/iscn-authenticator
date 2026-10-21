import type { D1Database } from '@cloudflare/workers-types';

export interface User {
	id: string;
	email: string;
	created_at: number;
	stripe_customer_id: string | null;
	plan: string;
	plan_expires_at: number | null;
}

export interface Session {
	id: string;
	user_id: string;
	expires_at: number;
}

export async function authenticateSession(db: D1Database, sessionId: string): Promise<{ user: User; session: Session } | null> {
  const row = await db.prepare(`SELECT u.*, s.id AS session_id, s.expires_at AS session_expires_at
    FROM session s JOIN user u ON u.id = s.user_id JOIN account_email_verification v ON v.user_id = u.id
    WHERE s.id = ? AND s.expires_at > ? AND v.email = lower(trim(u.email))`)
    .bind(sessionId, Math.floor(Date.now() / 1000)).first<User & { session_id: string; session_expires_at: number }>();
  if (!row) return null;
  const { session_id, session_expires_at, ...user } = row;
  return { user, session: { id: session_id, user_id: user.id, expires_at: session_expires_at } };
}
