-- Migration: account email on the users table
-- Lets every login account store + self-edit its own email in Profile.
-- Safe to run multiple times.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150);
