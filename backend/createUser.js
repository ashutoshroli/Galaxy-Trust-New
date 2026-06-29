// Create a login for a trust member (president/secretary/treasurer/trustee)
// Usage: node createUser.js <username> <password> <role> <member_id>
// role must be one of: president, secretary, treasurer, trustee
// member_id = id from the members table (run: SELECT id, name FROM members;)
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

async function run() {
  const [username, password, role, memberId] = process.argv.slice(2);

  if (!username || !password || !role || !memberId) {
    console.log('Usage: node createUser.js <username> <password> <role> <member_id>');
    process.exit(1);
  }

  const validRoles = ['admin', 'manager', 'president', 'secretary', 'treasurer', 'trustee', 'viewer'];
  if (!validRoles.includes(role)) {
    console.log('Role must be one of: ' + validRoles.join(', '));
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      'INSERT INTO users (username, password_hash, role, member_id) VALUES ($1,$2,$3,$4)',
      [username, hash, role, memberId]
    );
    console.log(`User "${username}" created with role "${role}" linked to member_id ${memberId}.`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

run();
