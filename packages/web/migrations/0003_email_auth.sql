CREATE INDEX IF NOT EXISTS user_normalized_email ON user(lower(trim(email)));

CREATE TABLE IF NOT EXISTS account_email_verification (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  verified_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS email_challenge (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('signup', 'login', 'recover')),
  code_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  claim TEXT
);
CREATE INDEX IF NOT EXISTS email_challenge_expiry ON email_challenge(expires_at);

CREATE TABLE IF NOT EXISTS email_auth_limit (
  id TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  resets_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS email_auth_limit_expiry ON email_auth_limit(resets_at);
