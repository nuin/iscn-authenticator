import type { D1Database } from '@cloudflare/workers-types';

export interface User {
	id: string;
	email: string;
	created_at: number;
	stripe_customer_id: string | null;
	plan: string;
	plan_expires_at: number | null;
}

export interface ApiKey {
	id: string;
	user_id: string | null;
	label: string;
	hash: string;
	env: string;
	created_at: number;
	last_used_at: number | null;
	revoked_at: number | null;
}

export interface Session {
	id: string;
	user_id: string;
	expires_at: number;
}

export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
	return await db.prepare('SELECT * FROM user WHERE email = ?').bind(email).first<User>();
}

export async function createUser(db: D1Database, email: string): Promise<User> {
	const id = crypto.randomUUID();
	const now = Math.floor(Date.now() / 1000);
	await db
		.prepare('INSERT INTO user (id, email, created_at) VALUES (?, ?, ?)')
		.bind(id, email, now)
		.run();
	return { id, email, created_at: now, stripe_customer_id: null, plan: 'free', plan_expires_at: null };
}

export async function createKey(
	db: D1Database,
	userId: string | null,
	label: string,
	env: 'live' | 'test' = 'live'
): Promise<{ record: ApiKey; plaintext: string }> {
	const id = crypto.randomUUID();
	const entropy = Array.from(crypto.getRandomValues(new Uint8Array(16)))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
	const plaintext = `iscn_${env}_${entropy}`;
	const hash = await sha256Hex(plaintext);
	const now = Math.floor(Date.now() / 1000);

	await db
		.prepare(
			'INSERT INTO api_key (id, user_id, label, hash, env, created_at) VALUES (?, ?, ?, ?, ?, ?)'
		)
		.bind(id, userId, label, hash, env, now)
		.run();

	return {
		record: {
			id,
			user_id: userId,
			label,
			hash,
			env,
			created_at: now,
			last_used_at: null,
			revoked_at: null
		},
		plaintext
	};
}

export async function validateKey(db: D1Database, plaintext: string): Promise<ApiKey | null> {
	const hash = await sha256Hex(plaintext);
	const key = await db
		.prepare('SELECT * FROM api_key WHERE hash = ? AND revoked_at IS NULL')
		.bind(hash)
		.first<ApiKey>();

	if (key) {
		const now = Math.floor(Date.now() / 1000);
		await db.prepare('UPDATE api_key SET last_used_at = ? WHERE id = ?').bind(now, key.id).run();
	}

	return key;
}

export async function createSession(db: D1Database, userId: string): Promise<Session> {
	const id = crypto.randomUUID();
	const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days
	await db
		.prepare('INSERT INTO session (id, user_id, expires_at) VALUES (?, ?, ?)')
		.bind(id, userId, expiresAt)
		.run();
	return { id, user_id: userId, expires_at: expiresAt };
}

export async function validateSession(db: D1Database, sessionId: string): Promise<Session | null> {
	const session = await db
		.prepare('SELECT * FROM session WHERE id = ?')
		.bind(sessionId)
		.first<Session>();

	if (!session) return null;

	if (session.expires_at < Math.floor(Date.now() / 1000)) {
		await db.prepare('DELETE FROM session WHERE id = ?').bind(sessionId).run();
		return null;
	}

	return session;
}

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
	await db.prepare('DELETE FROM session WHERE id = ?').bind(sessionId).run();
}

async function sha256Hex(input: string): Promise<string> {
	const bytes = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
