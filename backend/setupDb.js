// One-shot database setup / migration runner.
// Applies db/schema.sql (idempotent: uses CREATE TABLE IF NOT EXISTS, etc.)
// so a fresh OR existing database ends up with the full, up-to-date structure.
//
// Usage:
//   node setupDb.js
//
// Note: server.js also runs this automatically on every startup, so manual
// runs are mainly useful for local setup or to see migration errors clearly
// without waiting for the server to boot.
import 'dotenv/config';
import { pool } from './db.js';
import { applySchema } from './utils/migrate.js';

async function run() {
  console.log('Applying database schema from db/schema.sql ...');
  const ok = await applySchema(pool);
  if (ok) {
    console.log('✓ Database schema applied successfully.');
  } else {
    console.error('✗ Failed to apply schema. See error above.');
    process.exitCode = 1;
  }
  await pool.end();
}

run();
