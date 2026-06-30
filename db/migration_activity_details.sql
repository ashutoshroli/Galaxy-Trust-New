-- Migration: full activity log
-- Adds a details column and widens action so the Activity Log can record
-- every create/update/delete/reset action, not just login events.
-- Safe to run multiple times.

ALTER TABLE login_activity ALTER COLUMN action TYPE VARCHAR(80);
ALTER TABLE login_activity ADD COLUMN IF NOT EXISTS details TEXT;
