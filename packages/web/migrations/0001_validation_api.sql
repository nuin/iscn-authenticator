CREATE TABLE IF NOT EXISTS validation_api_key (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_validation_api_key_user ON validation_api_key(user_id);

CREATE TABLE IF NOT EXISTS api_entitlement (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL,
  price_id TEXT NOT NULL,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  monthly_limit INTEGER NOT NULL CHECK (monthly_limit > 0),
  CHECK (period_end > period_start)
);

CREATE TABLE IF NOT EXISTS api_usage (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  period_start INTEGER NOT NULL,
  validations INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, period_start)
);
CREATE TABLE IF NOT EXISTS api_rate_limit (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  minute_start INTEGER NOT NULL,
  requests INTEGER NOT NULL,
  request_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS api_billing_state (
  user_id TEXT PRIMARY KEY REFERENCES user(id),
  revision INTEGER NOT NULL,
  event_id TEXT NOT NULL
);

