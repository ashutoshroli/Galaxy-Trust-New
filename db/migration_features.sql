-- Migration: feature batch (search, announcements, MOM, member status/photo/dob)
-- Safe to run multiple times.

-- Members: active/inactive status, date of birth (birthday reminders), photo (ID card)
ALTER TABLE members ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE members ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS photo TEXT;

-- Meetings: minutes of meeting (MOM)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS minutes TEXT;

-- Announcements / notice board
CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    body TEXT,
    pinned BOOLEAN NOT NULL DEFAULT false,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at);
