PRAGMA foreign_keys = ON;

-- Store password hashes separately from user profile
CREATE TABLE IF NOT EXISTS user_credentials (
  user_id        TEXT PRIMARY KEY,
  password_hash  TEXT NOT NULL,
  password_salt  TEXT NOT NULL,
  password_algo  TEXT NOT NULL DEFAULT 'pbkdf2_sha256',
  created_at     INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at     INTEGER
);

-- Sessions for client auth (mobile/web)
CREATE TABLE IF NOT EXISTS user_sessions (
  token       TEXT PRIMARY KEY,        -- opaque random token
  user_id     TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  expires_at  INTEGER NOT NULL,
  revoked_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- Optional: make created_at for users default if you want
-- (Your existing users table allows null created_at)
