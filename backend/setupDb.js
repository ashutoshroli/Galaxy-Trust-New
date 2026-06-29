// One-shot database setup / migration runner.
// Applies db/schema.sql (idempotent: uses CREATE TABLE IF NOT EXISTS, etc.)
// so a fresh OR existing database ends up with the full, up-to-date structure.
//
// Usage:
//   node setupDb.js
//
// This replaces the need to run the individual db/migration_*.sql files by hand.
import 'dotenv/config';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '..', 'db', 'schema.sql');

async function run() {
  console.log('Applying database schema from db/schema.sql ...');
  let sql;
  try {
    sql = readFileSync(schemaPath, 'utf8');
  } catch (err) {
    console.error(`Could not read schema file at ${schemaPath}:`, err.message);
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✓ Database schema applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Failed to apply schema:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
