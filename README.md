# Task Manager

Multi-user task management app with tagging. Built with **React + TypeScript + Tailwind** (frontend) and **FastAPI + PostgreSQL** (backend).

## Features

- JWT authentication (register, login)
- Create, read, update, delete tasks
- Status (`todo` / `in_progress` / `done`) and priority (`low` / `medium` / `high`)
- Due dates
- Many-to-many tags with colors
- Filter by tag, status, search query
- Optimistic UI updates
- Dark mode

## Tech Stack

| Layer    | Stack                                                       |
|----------|-------------------------------------------------------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, TanStack Query, react-hook-form, zod, axios |
| Backend  | Python 3.12, FastAPI, SQLAlchemy 2 (async), Alembic, Pydantic v2, passlib, python-jose |
| DB       | PostgreSQL 16                                               |
| Tests    | Vitest + Playwright (FE), pytest + httpx (BE)               |
| Deploy   | Vercel (FE), Fly.io (BE + Postgres), GitHub Actions (CI)    |

## Repository Layout

```
task-manager/
├── frontend/               # React + Vite app
├── backend/                # FastAPI app
├── docker-compose.yml      # local Postgres + backend
├── .github/workflows/      # CI for both apps
└── README.md
```

## Running the project

### Prerequisites
- Docker Desktop (running)
- Node 20+

### Quick start (recommended) — Postgres + backend in Docker

`docker compose up -d` brings up **both** the database and the API. The
backend image runs `alembic upgrade head` on startup, so the schema is created
automatically — no manual migration step.

```bash
# from the repo root
docker compose up -d          # Postgres (:5432) + backend API (:8000)
docker compose ps             # both services should be "Up"; api is healthy once /docs loads
```

Then start the frontend:

```bash
cd frontend
npm install
cp .env.example .env          # VITE_API_BASE_URL=http://localhost:8000
npm run dev                   # http://localhost:5173
```

Open http://localhost:5173. The database starts empty, so **Register** an
account first, then sign in. API docs: http://localhost:8000/docs.

> If Vite reports port 5173 is taken it will use 5174/5175. The backend only
> allows the origin in `FRONTEND_URL` (default `http://localhost:5173`), so
> either free up 5173 or set `FRONTEND_URL` to your actual dev port in
> `docker-compose.yml` and re-run `docker compose up -d`.

Useful commands:

```bash
docker compose up -d --build  # rebuild the backend image after changing backend code
docker compose logs -f backend
docker compose down           # stop (data persists in the postgres_data volume)
```

### Alternative — run the backend locally (hot-reload)

Prefer this while actively editing backend code (Python 3.12+ required):

```bash
docker compose up -d postgres # just the database
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env           # adjust if needed
alembic upgrade head
uvicorn app.main:app --reload  # http://localhost:8000/docs
```

The frontend step is the same as above.

## Testing

```bash
# Backend
cd backend
pytest --cov=app --cov-report=term-missing

# Frontend
cd frontend
npm run test:coverage
npx playwright test
```

Coverage target: **≥ 80%** on both sides.

## Deployment

### Free path: Render + Neon + Vercel (recommended)

Total cost: **$0/mo, no credit card required**. Trade-off: backend cold-starts after ~15 min of idle.

#### 1. Postgres → Neon (always free, 0.5 GB)
1. Sign up at https://console.neon.tech (GitHub login).
2. Create a project, region close to you (e.g. Frankfurt).
3. Copy the **pooled** connection string. Convert it to async format:
   - Neon gives: `postgresql://user:pass@ep-xxx.region.aws.neon.tech/db?sslmode=require`
   - Use as **DATABASE_URL**: `postgresql+asyncpg://user:pass@ep-xxx.region.aws.neon.tech/db?ssl=require`
   - (Note: prefix `postgresql+asyncpg://` and rename `sslmode=require` → `ssl=require` for asyncpg.)

#### 2. Backend → Render (free web service)
1. Push the repo to GitHub (already done).
2. Open https://dashboard.render.com → **New** → **Blueprint**.
3. Connect the `task-manager` repo. Render reads `render.yaml` and proposes the service.
4. Set the two manual env vars:
   - **DATABASE_URL** = the Neon URL from step 1
   - **FRONTEND_URL** = `https://<your-vercel-app>.vercel.app` (placeholder for now; update after step 3)
5. Click **Apply**. First build takes 3–5 min. The URL will be `https://task-manager-api.onrender.com`.

#### 3. Frontend → Vercel
1. https://vercel.com/new → import the GitHub repo.
2. **Root Directory:** `frontend`
3. **Environment Variable:** `VITE_API_BASE_URL` = `https://task-manager-api.onrender.com`
4. Deploy.
5. Once Vercel gives you the URL, go back to Render dashboard → update `FRONTEND_URL` env var → Render redeploys automatically (CORS).

### Paid alternative: Fly.io (no cold starts, ~$4/mo)

```bash
cd backend
fly launch --no-deploy --copy-config
fly postgres create --name task-manager-db
fly postgres attach task-manager-db
fly secrets set JWT_SECRET=<random> FRONTEND_URL=https://<vercel>.vercel.app
fly deploy
```

## License

MIT
