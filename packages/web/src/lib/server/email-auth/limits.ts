import { digest } from './crypto.ts';

export class EmailAuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'EmailAuthError';
    this.status = status;
  }
}

export async function reserveEmail(db: D1Database, email: string, ip: string, now: number): Promise<void> {
  const [address, client] = await Promise.all([digest(email), digest(ip)]);
  const limits = [
    { id: `email-minute:${address}`, seconds: 60, max: 1 },
    { id: `email-hour:${address}`, seconds: 3600, max: 5 },
    { id: `ip-hour:${client}`, seconds: 3600, max: 20 },
    { id: 'service-day', seconds: 86400, max: 1000 },
  ];
  const reservation = `request:${crypto.randomUUID()}`;
  const conditions = limits.map(() => 'NOT EXISTS (SELECT 1 FROM email_auth_limit WHERE id = ? AND count >= ? AND resets_at > ?)');
  const reserve = db.prepare(`INSERT INTO email_auth_limit (id, count, resets_at)
    SELECT ?, 1, ? WHERE ${conditions.join(' AND ')} RETURNING id`)
    .bind(reservation, now + 60, ...limits.flatMap(({ id, max }) => [id, max, now]));
  const statements = limits.map(({ id, seconds }) => db.prepare(`
    INSERT INTO email_auth_limit (id, count, resets_at)
    SELECT ?, 1, ? WHERE EXISTS (SELECT 1 FROM email_auth_limit WHERE id = ?)
    ON CONFLICT(id) DO UPDATE SET
      count = CASE WHEN resets_at <= ? THEN 1 ELSE count + 1 END,
      resets_at = CASE WHEN resets_at <= ? THEN excluded.resets_at ELSE resets_at END
    `).bind(id, now + seconds, reservation, now, now));
  const results = await db.batch<{ id: string }>([reserve, ...statements,
    db.prepare('DELETE FROM email_auth_limit WHERE id = ?').bind(reservation)]);
  if (results[0].results.length === 0) {
    throw new EmailAuthError(429, 'Too many code requests. Wait at least a minute before trying again. Hourly limits may take longer to reset.');
  }
}
