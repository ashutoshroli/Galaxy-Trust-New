# Galaxy Educational and Social Welfare Trust - App

Full stack app: Node/Express backend + PostgreSQL + React/Vite frontend.
Built for self-hosting on Termux (Android).

## Folder structure
```
galaxy-trust/
  backend/        Node/Express API (port 3000)
  frontend/       React/Vite app (port 5174)
  db/schema.sql   PostgreSQL schema + seed (21 trust members)
```

## 1. Termux prerequisites
```bash
pkg update && pkg upgrade
pkg install nodejs postgresql git
```

## 2. PostgreSQL setup
```bash
mkdir -p $PREFIX/var/lib/postgresql
initdb $PREFIX/var/lib/postgresql
pg_ctl -D $PREFIX/var/lib/postgresql start

createuser dbadmin -P    # set password when prompted (e.g. 1234)
createdb galaxy_trust_db -O dbadmin
```

The full, up-to-date schema (including staff tables, fund-allocation tracking and
indexes) lives in `db/schema.sql`. You can apply it directly:
```bash
psql -U dbadmin -d galaxy_trust_db -f db/schema.sql
```
…or, after configuring the backend `.env` (step 3), use the built-in runner which
does the same thing and is safe to re-run on an existing database:
```bash
cd backend && npm run setup-db
```
> The individual `db/migration_*.sql` files are kept only for older databases;
> a fresh setup needs just `schema.sql` / `npm run setup-db`.

## 3. Backend setup
```bash
cd backend
npm install
cp .env.example .env
nano .env     # set DB_PASSWORD, JWT_SECRET etc.
```

Create the Super Admin login (sirf aapke paas):
```bash
node seedAdmin.js superadmin YourStrongPassword123
```

Create logins for President / Secretary / Treasurer / Trustee members
(member_id check karne ke liye: `psql -U dbadmin -d galaxy_trust_db -c "SELECT id, name, role FROM members;"`)
```bash
node createUser.js kiran_devi PresidentPass123 president 1
node createUser.js babita_verma SecretaryPass123 secretary 2
node createUser.js rekha_verma TreasurerPass123 treasurer 3
node createUser.js nand_kishor TrusteePass123 trustee 4
# ... repeat for each trustee with their member_id
```

Start backend:
```bash
npm start
```

## 4. Frontend setup
```bash
cd ../frontend
npm install
cp .env.example .env
nano .env     # set VITE_API_URL to your Cloudflare tunnel API URL or http://localhost:3000/api for local testing
npm run dev
```

## 5. Login
Open the frontend URL, login with the credentials created via `seedAdmin.js` / `createUser.js`.

## Roles & Permissions
| Role        | Count | Rights                  |
|-------------|-------|--------------------------|
| Super Admin | 1     | Add / Edit / Delete everything |
| President   | 1     | Add only                |
| Secretary   | 1     | Add only                |
| Treasurer   | 1     | Add only                |
| Trustee     | 18    | View only                |

## Security features
- Passwords hashed with bcrypt (never stored in plain text)
- JWT-based session tokens (expire after 8h by default)
- Account lockout after repeated wrong password attempts (configurable in `.env`)
- IP-based rate limiting on login endpoint
- Login activity log table (`login_activity`) — tracks every login attempt

## Modules
1. Members (21 trust members)
2. Contributions (who gave how much money)
3. Expenses (what the money was used for) — each expense simply draws from the
   total available fund (contributions + staff payments are tracked separately).
4. Staff (staff records + payment history)
5. Installments (total amount due, paid, baki/balance per member)
6. Meetings (date, location, subject, description, attendance)
7. Reports (contribution/expense reports, member balance ledger, fund usage, pending installments)
8. Dashboard (overall summary + fund-usage breakdown)

## Configuration notes
- `JWT_SECRET` (backend `.env`) **must** be set — the server refuses to start without it.
  Use a long random string (32+ chars) in production.
- `CORS_ORIGIN` (backend `.env`): comma-separated list of allowed frontend origins.
  Leave empty to allow all (handy for local/self-hosted setups).
- `VITE_API_URL` (frontend `.env`): point this at your backend API URL
  (`http://localhost:3000/api` locally, or your Cloudflare tunnel URL in production).
- Set `NODE_ENV=production` on the live server for JSON logs and hidden error stacks.

## Notes
- Change `JWT_SECRET` in backend `.env` to a long random string before going live.
- Route this through your existing Cloudflare tunnel (similar to VidyutConnect setup) for public access.
- This zip is structure + working code — review and adjust before production use.
