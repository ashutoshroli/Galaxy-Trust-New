// Create / reset login passwords for ALL trust members (superadmin is never touched).
//
// Usage:
//   node createMemberLogins.js
//
// For each member in the `members` table:
//   - if a (non-superadmin) login already exists -> keep username, set a NEW random
//     password, and unlock the account
//   - if no login exists -> create one with an auto-generated username + random password
// At the end it prints every member's username + new password. NOTE THESE DOWN —
// passwords are shown only once (they are stored hashed).
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

function slug(name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function genPassword(len = 10) {
  // Avoid ambiguous characters (0/O, 1/l/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < len; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

async function run() {
  try {
    const members = (await pool.query('SELECT id, name, role, phone FROM members ORDER BY id')).rows;
    if (members.length === 0) {
      console.log('Koi member nahi mila. Pehle members add karo.');
      return;
    }

    const creds = [];
    for (const m of members) {
      const password = genPassword();
      const hash = await bcrypt.hash(password, 10);

      const existing = (
        await pool.query("SELECT id, username FROM users WHERE member_id=$1 AND role <> 'superadmin'", [m.id])
      ).rows[0];

      let username;
      if (existing) {
        username = existing.username;
        await pool.query(
          'UPDATE users SET password_hash=$1, role=$2, phone=$3, failed_attempts=0, locked_until=NULL WHERE id=$4',
          [hash, m.role, m.phone || null, existing.id]
        );
      } else {
        let base = slug(m.name) || `member_${m.id}`;
        username = base;
        const taken = (await pool.query('SELECT 1 FROM users WHERE username=$1', [username])).rows[0];
        if (taken) username = `${base}_${m.id}`;
        await pool.query(
          'INSERT INTO users (username, password_hash, role, member_id, phone) VALUES ($1,$2,$3,$4,$5)',
          [username, hash, m.role, m.id, m.phone || null]
        );
      }
      creds.push({ name: m.name, role: m.role, username, password });
    }

    console.log('\n===================== MEMBER LOGINS =====================');
    console.log('(Note these down — passwords are shown only once)\n');
    creds.forEach((c) => {
      console.log(`${c.name}  [${c.role}]`);
      console.log(`   username: ${c.username}`);
      console.log(`   password: ${c.password}\n`);
    });
    console.log(`Total ${creds.length} member logins set. Superadmin untouched.`);
    console.log('=========================================================\n');
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
