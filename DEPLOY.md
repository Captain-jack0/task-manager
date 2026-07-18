# Deployment & DevOps

Free, no-credit-card stack, with **two environments driven by two branches**:

```
          dev  branch ──► DEV  env   (auto-deploys on every push)
          test branch ──► TEST env   (manual "Deploy" — you control when)

  each env:  Frontend (Vercel)  ──►  Backend API (Render)  ──►  Postgres (Neon)
             GitHub Actions run tests on every push / PR
             DB migrations run automatically on each backend boot (alembic upgrade head)
```

**Branch flow:** work on a feature branch → PR into **`dev`** (auto-deploys to the
dev env so you can try it live) → when it's stable, merge `dev` → **`test`** and
click **Manual Deploy** on the test service in Render (a deliberate, controlled
release to the test env). `main` stays as the stable trunk (promote to a prod env
later the same way if you want a third).

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

### 2 · Backend — Render (dev + test services)

1. In Neon, create **two databases** (or two branches of one project): one for
   **dev**, one for **test**. Grab a `DATABASE_URL` for each (scheme
   `postgresql+asyncpg://…`, as in step 1).
2. Sign up at [render.com](https://render.com) with GitHub (no card).
3. **New → Blueprint** → connect this repo. Render reads `render.yaml` and creates
   **two** services:
   - `task-manager-api-dev` — watches the **`dev`** branch, **autoDeploy: true**.
   - `task-manager-api-test` — watches the **`test`** branch, **autoDeploy: false**.
4. For **each** service set its secrets (Environment tab):
   - `DATABASE_URL` → the matching Neon dev / test database.
   - `FRONTEND_URL` → blank for now (only needed for a custom domain).
   - `JWT_SECRET` and `APP_ENCRYPTION_KEY` are **auto-generated per service** —
     don't touch them (the API refuses to boot in production without them).
5. **dev** deploys itself on the next push to `dev`. For **test**, you click
   **Manual Deploy → Deploy latest commit** on the `task-manager-api-test` service
   whenever you want to release. Migrations (`alembic upgrade head`) run on boot.
6. Note each service URL (e.g. `https://task-manager-api-dev.onrender.com`) and
   check `/health` returns `{"status":"ok"}`.

### 3 · Frontend — Vercel

1. Sign up at [vercel.com](https://vercel.com) with GitHub (no card).
2. **Add New → Project** → import this repo.
3. Set **Root Directory = `frontend`** (Vercel picks up `frontend/vercel.json`).
4. Set the **Production Branch** to `test` (Settings → Git). Then Vercel serves
   the `test` branch as production and gives every other branch (incl. `dev`) an
   auto-updating **preview** URL.
5. Point each env's frontend at the matching backend with **branch-specific env
   vars** (Settings → Environment Variables — set a value + choose the branch):
   - `VITE_API_BASE_URL` on branch `dev`  → `https://task-manager-api-dev.onrender.com`
   - `VITE_API_BASE_URL` on branch `test` → `https://task-manager-api-test.onrender.com`
6. Note the URLs (production = test branch; the `dev` preview URL is stable per branch).

> Custom domain (not `*.vercel.app`)? Set `FRONTEND_URL` on the matching Render
> service so CORS allows it, then redeploy that service.

### 4 · Gate merges on green tests (branch protection)

The dev env auto-deploys, so keep `dev` (and `test`) clean:

- GitHub repo → **Settings → Branches → Add branch ruleset** for `dev` **and** `test`:
  - Require a pull request before merging.
  - Require status checks to pass: `backend-ci`, `frontend-ci`, `mobile-ci`.

Flow: feature → PR → CI green → merge to **`dev`** (auto-deploys) → merge `dev`→`test`
→ **Manual Deploy** the test service in Render. ✅

---

## What's already automated (CI/CD)

- **`.github/workflows/backend-ci.yml`** — ruff lint, mypy types, pytest with an
  **80 % coverage gate**, against a real Postgres service container.
- **`.github/workflows/frontend-ci.yml`** — `tsc` type-check, vitest, production build.
- **`.github/workflows/mobile-ci.yml`** — `tsc` type-check + `expo-doctor`.
- **Deploy** — Render deploys the **dev** service on every push to `dev`; the
  **test** service is deployed manually (autoDeploy off) so you control the release.
  Vercel builds each branch (test = production, dev = preview).
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
