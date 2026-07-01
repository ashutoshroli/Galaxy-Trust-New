-- Migration: customizable notification/message templates.
-- Safe to run multiple times. (Also applied automatically via schema.sql on
-- every backend boot -- see backend/utils/migrate.js.)

CREATE TABLE IF NOT EXISTS notification_templates (
  template_key VARCHAR(60) PRIMARY KEY,
  title TEXT,
  body TEXT,
  email_subject TEXT,
  email_html TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
