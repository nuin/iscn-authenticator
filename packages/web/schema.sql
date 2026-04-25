-- packages/web/schema.sql

-- Auth (Lucia v3 conventions)
CREATE TABLE user (
  id          TEXT PRIMARY KEY,               -- ulid or uuid
  email       TEXT UNIQUE NOT NULL,
  created_at  INTEGER NOT NULL,               -- unix seconds
  stripe_customer_id TEXT UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'free',   -- free | pro_trial | pro | canceled
  plan_expires_at INTEGER                     -- unix seconds; null if free
);

CREATE TABLE session (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL
);

CREATE TABLE magic_link (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  INTEGER NOT NULL,
  consumed_at INTEGER
);

-- API Keys
CREATE TABLE api_key (
  id          TEXT PRIMARY KEY,               -- uuid
  user_id     TEXT REFERENCES user(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  hash        TEXT UNIQUE NOT NULL,           -- sha256 of plaintext
  env         TEXT NOT NULL,                  -- live | test
  created_at  INTEGER NOT NULL,               -- unix seconds
  last_used_at INTEGER,
  revoked_at  INTEGER
);
CREATE INDEX idx_api_key_user ON api_key(user_id);
CREATE INDEX idx_api_key_hash ON api_key(hash);

-- Product data
CREATE TABLE batch (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name        TEXT,
  row_count   INTEGER NOT NULL,
  valid_count INTEGER NOT NULL,
  error_count INTEGER NOT NULL,
  csv_r2_key  TEXT,                           -- R2 key if >256kb, else null
  csv_inline  TEXT,                           -- raw CSV if <=256kb
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL                -- created_at + 30 days
);
CREATE INDEX idx_batch_user_created ON batch(user_id, created_at DESC);
CREATE INDEX idx_batch_expires ON batch(expires_at);

CREATE TABLE snippet (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  karyotype   TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  UNIQUE(user_id, name)
);
CREATE INDEX idx_snippet_user ON snippet(user_id);

-- Stripe webhook idempotency
CREATE TABLE processed_webhook (
  event_id    TEXT PRIMARY KEY,
  processed_at INTEGER NOT NULL
);
