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

> Free Render services sleep after inactivity; first request may take ~30s to wake.

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

## 4. Auto-deploy (CI/CD)
Once connected:
- Push to `main` → **Render** rebuilds + redeploys the backend automatically.
- Push to `main` → **Vercel** rebuilds + redeploys the frontend automatically.

Nothing else to configure.

---

## 5. First login
Open your Vercel URL and sign in with the superadmin you created in step 1.
Create member logins from the **Permissions** page (or `node createMemberLogins.js` with `DATABASE_URL`).
