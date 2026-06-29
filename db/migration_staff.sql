-- Run this once on your existing database:
-- psql -U dbadmin -d galaxy_trust_db -f db/migration_staff.sql

CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    contact VARCHAR(15),
    address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff_payments (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    remarks TEXT,
    added_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
