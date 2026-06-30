-- Migration: member email + self-service profile editing
-- Safe to run multiple times.

ALTER TABLE members ADD COLUMN IF NOT EXISTS email VARCHAR(150);
