PRAGMA foreign_keys = ON;

-- Sessions already exist from 0001_init.sql, but indexes are still useful:
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Optional: ensure users.created_at is set going forward (won't backfill existing nulls)
-- Note: SQLite can't ALTER COLUMN to add DEFAULT; you'd handle it in app code or with an INSERT default.
