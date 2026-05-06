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

## Local Development

### Prerequisites
- Node 20+
- Python 3.12+
- Docker (for Postgres)

### 1. Start Postgres
```bash
docker compose up -d postgres
```

### 2. Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env                # adjust if needed
alembic upgrade head
uvicorn app.main:app --reload       # http://localhost:8000/docs
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env                # VITE_API_BASE_URL=http://localhost:8000
npm run dev                          # http://localhost:5173
```

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

### Backend → Fly.io
```bash
cd backend
fly launch                              # uses Dockerfile + fly.toml
fly postgres create --name task-manager-db
fly postgres attach task-manager-db
fly secrets set JWT_SECRET=<random> FRONTEND_URL=https://<vercel>.vercel.app
fly deploy
```

### Frontend → Vercel
- Import GitHub repo on Vercel
- **Root Directory:** `frontend`
- **Build:** `npm run build`, **Output:** `dist`
- **Env:** `VITE_API_BASE_URL=https://<fly-app>.fly.dev`

## License

MIT
