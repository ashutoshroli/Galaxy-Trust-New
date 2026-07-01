# Deploying Galaxy Trust (free, with auto-deploy on git push)

Stack used here:
- **Database:** Neon (free PostgreSQL)
- **Backend:** Render (free web service)
- **Frontend:** Vercel (free static hosting)

Each service connects to your GitHub repo and **auto-deploys on every push** — that is your CI/CD.

> Tip: merge your work to the `main` branch first and deploy from `main`.

---

## 1. Database — Neon
1. Sign up at https://neon.tech (free, with GitHub).
2. Create a project → it gives a **connection string** like:
   `postgresql://user:pass@ep-xxx.aws.neon.tech/dbname?sslmode=require`
3. Copy it — you'll use it as `DATABASE_URL`.

Load the schema (from your computer/Termux, one time):
```bash
cd backend
DATABASE_URL="<neon connection string>" DB_SSL=true npm run setup-db
DATABASE_URL="<neon connection string>" DB_SSL=true node seedAdmin.js superadmin YourStrongPass123
```

---

## 2. Backend — Render
1. Sign up at https://render.com with GitHub.
2. **New → Web Service** → pick your `galaxy-trust` repo.
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Branch:** `main` (auto-deploys on push to this branch)
4. **Environment variables** (Add):
   - `DATABASE_URL` = your Neon string
   - `DB_SSL` = `true`
   - `JWT_SECRET` = a long random string (32+ chars)
   - `NODE_ENV` = `production`
   - `CORS_ORIGIN` = your Vercel URL (add after step 3, e.g. `https://galaxy-trust.vercel.app`)
5. Deploy. You'll get a backend URL like `https://galaxy-trust-api.onrender.com`.
   Your API base is that URL + `/api`.

> The database schema (`db/schema.sql`) is applied automatically every time the
> backend starts (it's safe to re-run — see `backend/utils/migrate.js`), so
> after the very first deploy you generally don't need to run `setup-db`
> again manually, even for future schema changes. Set `SKIP_AUTO_MIGRATE=true`
> if you'd rather manage migrations by hand.

> **Free Render services sleep after ~15 minutes of inactivity.** The next
> request then takes ~30-50s to "wake" the service (cold start), which can
> feel like the app is broken. See **Keep the backend awake (free tier)**
> below for options to avoid this.

---

## 3. Frontend — Vercel
1. Sign up at https://vercel.com with GitHub.
2. **Add New → Project** → import `galaxy-trust`.
3. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. **Environment variable:**
   - `VITE_API_URL` = `https://<your-render-backend>.onrender.com/api`
5. Deploy. You'll get a URL like `https://galaxy-trust.vercel.app`.
6. Go back to Render and set `CORS_ORIGIN` to this Vercel URL, then redeploy backend.

---

## 3.5 Keep the backend awake (free tier)
Render's free web services spin down after ~15 minutes without traffic and
take ~30-50s to cold-start on the next request. If that pause is a problem,
pick one:

**Option A — Upgrade Render's plan (most reliable)**
Render's paid instance types don't sleep. Best choice for a production app
with real users.

**Option B — Self-ping with the included GitHub Actions workflow (free)**
This repo ships `.github/workflows/keep-alive.yml`, which pings your
`/api/health` endpoint every 10 minutes to keep the service warm. To enable it:
1. In GitHub → your repo → **Settings → Secrets and variables → Actions → Variables**.
2. Add a repository variable named `RENDER_HEALTH_URL` with your backend's
   health URL, e.g. `https://galaxy-trust-api.onrender.com/api/health`.
3. That's it — the workflow runs automatically on its schedule. You can also
   trigger it manually from the **Actions** tab (`keep-alive` → **Run workflow**).

> Note: this only keeps the service warm while GitHub Actions is scheduling
> the workflow (best-effort, not guaranteed to the minute) and while your repo
> has Actions minutes available (free on public repos; private repos get a
> monthly quota). It also doesn't help the very first visitor after a gap
> longer than the ping interval — it just makes cold starts much rarer.

**Option C — External uptime monitor (free, more precise)**
Services like [cron-job.org](https://cron-job.org) or
[UptimeRobot](https://uptimerobot.com) can ping your `/api/health` URL every
5 minutes from outside GitHub, which is more punctual than GitHub Actions'
schedule and also gives you uptime alerts. Point it at the same
`/api/health` URL as above.

---

## 4. Auto-deploy (CI/CD)
Once connected:
- Push to `main` → **Render** rebuilds + redeploys the backend automatically.
- Push to `main` → **Vercel** rebuilds + redeploys the frontend automatically.

Nothing else to configure.

---

## 5. First login
Open your Vercel URL and sign in with the superadmin you created in step 1.
Create member logins from the **Permissions** page (or `node createMemberLogins.js` with `DATABASE_URL`).
