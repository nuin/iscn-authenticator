CREATE TABLE IF NOT EXISTS api_checkout_attempt (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  parameters TEXT NOT NULL,
  stripe_session_id TEXT
);
