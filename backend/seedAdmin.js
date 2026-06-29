// Run this once to create the Super Admin login:
//   node seedAdmin.js <username> <password>
// Example: node seedAdmin.js superadmin MyStrongPass123
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

async function seed() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.log('Usage: node seedAdmin.js <username> <password>');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  try {
    const existing = await pool.query('SELECT id FROM users WHERE username=$1', [username]);
    if (existing.rows[0]) {
      await pool.query('UPDATE users SET password_hash=$1, role=$2, failed_attempts=0, locked_until=NULL WHERE username=$3', [
        hash,
        'superadmin',
        username,
      ]);
      console.log(`Super Admin "${username}" password updated and account unlocked.`);
    } else {
      await pool.query(
        'INSERT INTO users (username, password_hash, role) VALUES ($1,$2,$3)',
        [username, hash, 'superadmin']
      );
      console.log(`Super Admin "${username}" created successfully.`);
    }
  } catch (err) {
    console.error('Error seeding admin:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
