-- Run this once on your existing database:
-- psql -U dbadmin -d galaxy_trust_db -f db/migration_installment_id.sql

ALTER TABLE contributions
ADD COLUMN IF NOT EXISTS installment_id INTEGER;

ALTER TABLE contributions
  DROP CONSTRAINT IF EXISTS fk_contributions_installment;
ALTER TABLE contributions
  ADD CONSTRAINT fk_contributions_installment
  FOREIGN KEY (installment_id) REFERENCES installments(id) ON DELETE SET NULL;
