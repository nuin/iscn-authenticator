async function getUserByEmail(db, email) {
  return await db.prepare("SELECT * FROM user WHERE email = ?").bind(email).first();
}
async function createUser(db, email) {
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1e3);
  await db.prepare("INSERT INTO user (id, email, created_at) VALUES (?, ?, ?)").bind(id, email, now).run();
  return { id, email, created_at: now, stripe_customer_id: null, plan: "free", plan_expires_at: null };
}
async function createKey(db, userId, label, env = "live") {
  const id = crypto.randomUUID();
  const entropy = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("");
  const plaintext = `iscn_${env}_${entropy}`;
  const hash = await sha256Hex(plaintext);
  const now = Math.floor(Date.now() / 1e3);
  await db.prepare(
    "INSERT INTO api_key (id, user_id, label, hash, env, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(id, userId, label, hash, env, now).run();
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
async function validateKey(db, plaintext) {
  const hash = await sha256Hex(plaintext);
  const key = await db.prepare("SELECT * FROM api_key WHERE hash = ? AND revoked_at IS NULL").bind(hash).first();
  if (key) {
    const now = Math.floor(Date.now() / 1e3);
    await db.prepare("UPDATE api_key SET last_used_at = ? WHERE id = ?").bind(now, key.id).run();
  }
  return key;
}
async function createSession(db, userId) {
  const id = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1e3) + 30 * 24 * 60 * 60;
  await db.prepare("INSERT INTO session (id, user_id, expires_at) VALUES (?, ?, ?)").bind(id, userId, expiresAt).run();
  return { id, user_id: userId, expires_at: expiresAt };
}
async function validateSession(db, sessionId) {
  const session = await db.prepare("SELECT * FROM session WHERE id = ?").bind(sessionId).first();
  if (!session) return null;
  if (session.expires_at < Math.floor(Date.now() / 1e3)) {
    await db.prepare("DELETE FROM session WHERE id = ?").bind(sessionId).run();
    return null;
  }
  return session;
}
async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export {
  createSession as a,
  createUser as b,
  createKey as c,
  validateSession as d,
  getUserByEmail as g,
  validateKey as v
};
