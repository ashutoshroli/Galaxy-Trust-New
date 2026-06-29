-- Run this once on your existing database to add the "type" field to installments
-- (e.g. Membership Fee, Building Fund, etc. — free text, set by Admin while creating)
-- psql -U dbadmin -d galaxy_trust_db -f db/migration_installment_type.sql

ALTER TABLE installments
ADD COLUMN IF NOT EXISTS type VARCHAR(100) NOT NULL DEFAULT 'General';
