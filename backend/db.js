import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// Cloud Postgres (Neon / Render / Supabase) gives a single connection string and
// requires SSL. Locally (Termux) we use individual DB_* vars without SSL.
const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl })
  : new Pool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      ssl,
    });

pool.on('error', (err) => {
  console.error('Unexpected DB error', err);
});
