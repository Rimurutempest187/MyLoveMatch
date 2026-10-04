-- MatchMaker — D1 schema (run once: npm run db:init)
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,          -- Telegram user id
  username      TEXT,
  lang          TEXT NOT NULL DEFAULT 'en',
  state         TEXT,                         -- FSM step, e.g. 'reg:name'
  data          TEXT,                         -- JSON payload for current step
  is_registered INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  is_banned     INTEGER NOT NULL DEFAULT 0,
  active_match  INTEGER,
  last_active   TEXT
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  age         INTEGER NOT NULL CHECK (age >= 18),
  gender      TEXT NOT NULL,
  pref_gender TEXT NOT NULL DEFAULT 'everyone',
  city        TEXT NOT NULL,
  bio         TEXT NOT NULL DEFAULT '',
  photo       TEXT,
  min_age     INTEGER NOT NULL DEFAULT 18,
  max_age     INTEGER NOT NULL DEFAULT 99
);
CREATE TABLE IF NOT EXISTS likes (
  from_user  INTEGER NOT NULL,
  to_user    INTEGER NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'like',
  created_at TEXT,
  PRIMARY KEY (from_user, to_user)
);
CREATE TABLE IF NOT EXISTS matches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a     INTEGER NOT NULL,
  user_b     INTEGER NOT NULL,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  UNIQUE (user_a, user_b)
);
CREATE TABLE IF NOT EXISTS blocks (
  blocker INTEGER NOT NULL,
  blocked INTEGER NOT NULL,
  PRIMARY KEY (blocker, blocked)
);
CREATE INDEX IF NOT EXISTS ix_profiles_filter ON profiles(gender, age);
CREATE INDEX IF NOT EXISTS ix_likes_to ON likes(to_user);
