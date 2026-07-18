# Deployment & DevOps

Free, no-credit-card stack:

```
Frontend (Vercel)  ──►  Backend API (Render)  ──►  Postgres (Neon)
        auto-deploy on push to main      auto-deploy on push to main
        GitHub Actions run tests on every push / PR
        DB migrations run automatically on each backend boot (alembic upgrade head)
```

| Piece | Host | Free? | Notes |
|-------|------|-------|-------|
| Database | **Neon** | ✅ always-free, no card | Serverless Postgres |
| Backend | **Render** | ✅ free, no card | Sleeps after 15 min idle → ~30 s cold start |
| Frontend | **Vercel** | ✅ free, no card | Instant, global CDN |
| Mobile | **Expo EAS** | ✅ free tier | Optional, separate track (see bottom) |

---

## One-time setup

Do these in order — each step needs a URL from the previous one.

### 1 · Database — Neon

1. Sign up at [neon.tech](https://neon.tech) with your GitHub account (no card).
2. **Create project** (pick the region nearest you, e.g. Frankfurt).
3. On the dashboard, copy the **connection string**. It looks like:
   `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
4. Change the scheme `postgresql://` → **`postgresql+asyncpg://`**. Keep the rest as-is.
   The backend strips `sslmode`/`channel_binding` and enables TLS itself, so the
   provider string works almost verbatim. Save this as your **`DATABASE_URL`**.

### 2 · Backend — Render

1. Sign up at [render.com](https://render.com) with GitHub (no card).
2. **New → Blueprint** → connect this repo. Render reads `render.yaml` and creates
   the `task-manager-api` web service (Docker, Frankfurt, free plan).
3. Set the two secrets it asks for (Environment tab):
   - `DATABASE_URL` → the Neon string from step 1.
   - `FRONTEND_URL` → leave blank for now (fill in step 3 only if you use a custom
     domain; the built-in CORS rule already allows any `*.vercel.app`).
   - `JWT_SECRET` and `APP_ENCRYPTION_KEY` are **auto-generated** by `render.yaml`
     — don't touch them. (The API refuses to boot in production without them.)
4. Deploy. On boot the container runs `alembic upgrade head` automatically, so the
   schema is created/updated with no manual step.
5. Copy the service URL, e.g. `https://task-manager-api.onrender.com`. Check
   `https://task-manager-api.onrender.com/health` returns `{"status":"ok"}`.

### 3 · Frontend — Vercel

1. Sign up at [vercel.com](https://vercel.com) with GitHub (no card).
2. **Add New → Project** → import this repo.
3. Set **Root Directory = `frontend`** (Vercel picks up `frontend/vercel.json`).
4. Add an environment variable:
   - `VITE_API_BASE_URL` → your Render URL from step 2 (e.g.
     `https://task-manager-api.onrender.com`).
5. Deploy. Note the URL, e.g. `https://task-manager.vercel.app`.

> If you later add a **custom domain** (not `*.vercel.app`), set `FRONTEND_URL` in
> Render to it so CORS allows it, then redeploy the backend.

### 4 · Gate deploys on green tests (branch protection)

Deploys happen when `main` changes. To make sure only *tested* code reaches `main`:

- GitHub repo → **Settings → Branches → Add branch ruleset** for `main`:
  - Require a pull request before merging.
  - Require status checks to pass: `backend-ci`, `frontend-ci` (and `mobile-ci`).

Now the flow is: branch → PR → CI must be green → merge → auto-deploy. ✅

---

## What's already automated (CI/CD)

- **`.github/workflows/backend-ci.yml`** — ruff lint, mypy types, pytest with an
  **80 % coverage gate**, against a real Postgres service container.
- **`.github/workflows/frontend-ci.yml`** — `tsc` type-check, vitest with coverage,
  production build.
- **`.github/workflows/mobile-ci.yml`** — `tsc` type-check + `expo-doctor`.
- **Deploy** — Render (backend) and Vercel (frontend) each watch `main` and
  redeploy on push. No deploy keys to manage.
- **DB migrations** — `alembic upgrade head` on every backend boot (`Dockerfile`).

---

## Environment variables reference

**Backend (Render):**

| Var | Value | Set by |
|-----|-------|--------|
| `DATABASE_URL` | Neon `postgresql+asyncpg://…` | you |
| `JWT_SECRET` | random | `render.yaml` (auto) |
| `APP_ENCRYPTION_KEY` | random | `render.yaml` (auto) |
| `ENVIRONMENT` | `production` | `render.yaml` |
| `FRONTEND_URL` | your custom domain (optional) | you |

**Frontend (Vercel):**

| Var | Value |
|-----|-------|
| `VITE_API_BASE_URL` | `https://task-manager-api.onrender.com` |

---

## Mobile (Expo EAS) — optional

The mobile app deploys to the app stores, not a web host:

1. `npm i -g eas-cli && eas login` (free Expo account).
2. In `mobile/app.json`, set `expo.extra.apiBaseUrl` to your Render URL.
3. `cd mobile && eas build:configure`, then `eas build --platform android`
   (and/or `ios`). EAS builds in the cloud (free tier).
4. Submit with `eas submit`, or share the build link directly for testing.

---

## Troubleshooting

- **Backend won't boot in prod** → `JWT_SECRET`/`APP_ENCRYPTION_KEY` not set. With
  `render.yaml` they're auto-generated; if you created the service manually, add them.
- **DB connection error / `sslmode` error** → make sure the scheme is
  `postgresql+asyncpg://`. The app handles the `sslmode`/`channel_binding` params.
- **CORS error in the browser** → the frontend origin isn't allowed. `*.vercel.app`
  is allowed automatically; for a custom domain set `FRONTEND_URL` in Render.
- **First request after idle is slow (~30 s)** → Render free tier cold start; the
  next requests are fast. Upgrade the plan or ping `/health` on a schedule to avoid it.
- **GitHub integration fails after deploy** → the connected PAT is per-user and
  encrypted with `APP_ENCRYPTION_KEY`; if that key changes, reconnect GitHub.
