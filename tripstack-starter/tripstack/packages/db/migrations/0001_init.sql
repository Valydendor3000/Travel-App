-- Example minimal tables
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  group_id TEXT,
  title TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_links (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  label TEXT NOT NULL,
  vendor_url TEXT NOT NULL
);
