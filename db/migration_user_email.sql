-- Migration: account email on the users table
-- Lets every login account store + self-edit its own email in Profile,
-- and allows logging in with email (in addition to username / mobile).
-- Safe to run multiple times.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150);

-- Email is a login identifier, so it must be unique (case-insensitive), ignoring NULLs.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (LOWER(email)) WHERE email IS NOT NULL;
