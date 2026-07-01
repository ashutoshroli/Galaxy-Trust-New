-- Migration: active sessions, meeting agenda + voting, installment reminder tracking.
-- Safe to run multiple times. (Also applied automatically via schema.sql on
-- every backend boot -- see backend/utils/migrate.js.)

CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jti VARCHAR(64) NOT NULL UNIQUE,
  device_label VARCHAR(200),
  ip_address VARCHAR(50),
  remember BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_jti ON user_sessions(jti);

ALTER TABLE installments ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMP;

CREATE TABLE IF NOT EXISTS meeting_agenda_items (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  title VARCHAR(300) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','passed','rejected','withdrawn')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agenda_items_meeting ON meeting_agenda_items(meeting_id);

CREATE TABLE IF NOT EXISTS meeting_agenda_votes (
  id SERIAL PRIMARY KEY,
  agenda_item_id INTEGER NOT NULL REFERENCES meeting_agenda_items(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  vote VARCHAR(10) NOT NULL CHECK (vote IN ('yes','no','abstain')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (agenda_item_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_agenda_votes_item ON meeting_agenda_votes(agenda_item_id);
