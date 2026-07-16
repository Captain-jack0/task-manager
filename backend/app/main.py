from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api import auth, comments, integrations, projects, tags, tasks, workspaces
from app.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.rate_limit import limiter


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Task Manager API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        # Allow Vercel preview deployments (e.g. task-manager-git-feat-xxx.vercel.app).
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Rate limiting (slowapi) — protects auth + third-party endpoints from abuse.
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    register_exception_handlers(app)

    app.include_router(auth.router)
    app.include_router(workspaces.router)
    app.include_router(projects.router)
    app.include_router(tasks.router)
    app.include_router(comments.router)
    app.include_router(tags.router)
    app.include_router(integrations.router)

    @app.get("/health", tags=["health"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
