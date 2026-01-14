-- migrations/0001_init.sql

-- Users (client accounts)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at INTEGER,
  password_salt TEXT,
  password_hash TEXT,
  password_iters INTEGER DEFAULT 150000
);

-- Brands
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  primary_color TEXT DEFAULT '#0ea5e9',
  logo_url TEXT,
  app_icon_url TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  twitter_url TEXT,
  tiktok_url TEXT
);

-- Groups
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INTEGER DEFAULT 0,
  brand_id TEXT,
  leader_user_id TEXT
);

-- Group members (many-to-many users <-> groups)
CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

-- Trips
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date INTEGER,
  end_date INTEGER,
  notes TEXT,
  is_public INTEGER DEFAULT 0,
  has_cruise INTEGER DEFAULT 0,
  has_flights INTEGER DEFAULT 0,
  has_hotel INTEGER DEFAULT 0,
  has_all_inclusive INTEGER DEFAULT 0
);

-- Payment links
CREATE TABLE IF NOT EXISTS payment_links (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  label TEXT NOT NULL,
  vendor_url TEXT NOT NULL,
  due_at INTEGER
);

-- Trip submissions (client ideas)
CREATE TABLE IF NOT EXISTS trip_submissions (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_date INTEGER,
  end_date INTEGER,
  notes TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

-- Cruise cabins
CREATE TABLE IF NOT EXISTS cruise_cabins (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  cabin_no TEXT,
  category TEXT,
  deck TEXT,
  guests INTEGER,
  price_cents INTEGER,
  notes TEXT
);

-- Flight segments
CREATE TABLE IF NOT EXISTS flight_segments (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  carrier TEXT,
  flight_no TEXT,
  depart_airport TEXT,
  arrive_airport TEXT,
  depart_ts INTEGER,
  arrive_ts INTEGER,
  record_locator TEXT
);

-- Hotel rooms
CREATE TABLE IF NOT EXISTS hotel_rooms (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  hotel_name TEXT,
  room_type TEXT,
  check_in_ts INTEGER,
  check_out_ts INTEGER,
  occupants INTEGER,
  confirmation TEXT
);

-- All-inclusive packages
CREATE TABLE IF NOT EXISTS ai_packages (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  resort_name TEXT,
  plan_name TEXT,
  check_in_ts INTEGER,
  check_out_ts INTEGER,
  occupants INTEGER,
  confirmation TEXT
);

-- User sessions (client auth sessions)
CREATE TABLE IF NOT EXISTS user_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);

-- Helpful indexes (recommended)
CREATE INDEX IF NOT EXISTS idx_trips_group_id ON trips(group_id);
CREATE INDEX IF NOT EXISTS idx_payments_group_id ON payment_links(group_id);
CREATE INDEX IF NOT EXISTS idx_trip_submissions_group_id ON trip_submissions(group_id);
CREATE INDEX IF NOT EXISTS idx_cabins_trip_id ON cruise_cabins(trip_id);
CREATE INDEX IF NOT EXISTS idx_flights_trip_id ON flight_segments(trip_id);
CREATE INDEX IF NOT EXISTS idx_hotels_trip_id ON hotel_rooms(trip_id);
CREATE INDEX IF NOT EXISTS idx_ai_trip_id ON ai_packages(trip_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
  name           TEXT NOT NULL,
  capacity       INTEGER DEFAULT 0,
  brand_id       TEXT,
  leader_user_id TEXT
);

-- Group members (who can see group trips)
CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

-- Trips
CREATE TABLE IF NOT EXISTS trips (
  id               TEXT PRIMARY KEY,
  group_id         TEXT NOT NULL,
  title            TEXT NOT NULL,
  start_date       INTEGER,
  end_date         INTEGER,
  notes            TEXT,
  is_public        INTEGER DEFAULT 0,
  has_cruise       INTEGER DEFAULT 0,
  has_flights      INTEGER DEFAULT 0,
  has_hotel        INTEGER DEFAULT 0,
  has_all_inclusive INTEGER DEFAULT 0
);

-- Payment links
CREATE TABLE IF NOT EXISTS payment_links (
  id        TEXT PRIMARY KEY,
  group_id  TEXT NOT NULL,
  label     TEXT NOT NULL,
  vendor_url TEXT NOT NULL,
  due_at    INTEGER
);

-- Trip submissions (client “ideas”)
CREATE TABLE IF NOT EXISTS trip_submissions (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL,
  title      TEXT NOT NULL,
  start_date INTEGER,
  end_date   INTEGER,
  notes      TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

-- Cruise cabins
CREATE TABLE IF NOT EXISTS cruise_cabins (
  id         TEXT PRIMARY KEY,
  trip_id    TEXT NOT NULL,
  cabin_no   TEXT,
  category   TEXT,
  deck       TEXT,
  guests     INTEGER,
  price_cents INTEGER,
  notes      TEXT
);

-- Flight segments
CREATE TABLE IF NOT EXISTS flight_segments (
  id            TEXT PRIMARY KEY,
  trip_id       TEXT NOT NULL,
  carrier       TEXT,
  flight_no     TEXT,
  depart_airport TEXT,
  arrive_airport TEXT,
  depart_ts     INTEGER,
  arrive_ts     INTEGER,
  record_locator TEXT
);

-- Hotel rooms
CREATE TABLE IF NOT EXISTS hotel_rooms (
  id          TEXT PRIMARY KEY,
  trip_id     TEXT NOT NULL,
  hotel_name  TEXT NOT NULL,
  room_type   TEXT,
  check_in_ts INTEGER,
  check_out_ts INTEGER,
  occupants   INTEGER,
  confirmation TEXT
);

-- All-inclusive packages
CREATE TABLE IF NOT EXISTS ai_packages (
  id          TEXT PRIMARY KEY,
  trip_id     TEXT NOT NULL,
  resort_name TEXT NOT NULL,
  plan_name   TEXT,
  check_in_ts INTEGER,
  check_out_ts INTEGER,
  occupants   INTEGER,
  confirmation TEXT
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_trips_group_id ON trips(group_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_group_id ON payment_links(group_id);
CREATE INDEX IF NOT EXISTS idx_trip_submissions_group_id ON trip_submissions(group_id);
CREATE INDEX IF NOT EXISTS idx_cruise_cabins_trip_id ON cruise_cabins(trip_id);
CREATE INDEX IF NOT EXISTS idx_flight_segments_trip_id ON flight_segments(trip_id);
CREATE INDEX IF NOT EXISTS idx_hotel_rooms_trip_id ON hotel_rooms(trip_id);
CREATE INDEX IF NOT EXISTS idx_ai_packages_trip_id ON ai_packages(trip_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
