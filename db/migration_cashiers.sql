-- Migration: Cashier feature
-- Adds the ability to designate members as "cashiers" who handle money
-- moving IN (contributions) or OUT (expenses / staff payments), and to record
-- how much of each transaction each cashier handled.
-- Safe to run multiple times.

-- Members designated as cashiers
CREATE TABLE IF NOT EXISTS cashiers (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Per-transaction cashier allocations (polymorphic).
-- ref_type + ref_id point to a contribution / expense / staff_payment row.
-- direction: 'in'  = money collected by the cashier (contributions)
--            'out' = money disbursed by the cashier (expenses / staff payments)
CREATE TABLE IF NOT EXISTS cashier_allocations (
    id SERIAL PRIMARY KEY,
    ref_type VARCHAR(20) NOT NULL CHECK (ref_type IN ('contribution','expense','staff_payment')),
    ref_id INTEGER NOT NULL,
    cashier_member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    direction VARCHAR(3) NOT NULL CHECK (direction IN ('in','out')),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cashier_alloc_ref ON cashier_allocations(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS idx_cashier_alloc_cashier ON cashier_allocations(cashier_member_id);
CREATE INDEX IF NOT EXISTS idx_cashier_alloc_direction ON cashier_allocations(direction);
