// Applies db/schema.sql to the connected database.
//
// schema.sql is written to be fully idempotent (CREATE TABLE IF NOT EXISTS,
// ALTER TABLE ... ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, etc.),
// so re-running it on every boot is always safe — it brings a fresh OR an
// existing database up to the latest structure without needing anyone to
// manually paste SQL into Neon/psql after every feature ships.
//
// Used by both setupDb.js (manual `npm run setup-db`) and server.js
// (automatic, on every startup).
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '..', '..', 'db', 'schema.sql');

export async function applySchema(pool) {
  const sql = readFileSync(schemaPath, 'utf8');
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    logger.error('Database schema migration failed (could not connect)', { message: err.message });
    return false;
  }
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    logger.info('Database schema is up to date', { schemaPath });
    return true;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Database schema migration failed', { message: err.message });
    return false;
  } finally {
    client.release();
  }
}
