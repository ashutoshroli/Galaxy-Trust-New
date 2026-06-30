-- Migration: sidebar page permissions per role
-- Controls which sidebar pages each role can see. Missing rows = visible (default).
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS nav_permissions (
    role VARCHAR(20) NOT NULL,
    page_key VARCHAR(40) NOT NULL,
    visible BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (role, page_key)
);
