from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request, Response, status

from app.api.deps import CurrentUser, SessionDep
from app.config import get_settings
from app.core.rate_limit import limiter
from app.repositories import calendar_repo
from app.schemas.calendar import CalendarSubscriptionOut
from app.services import ics

router = APIRouter(prefix="/calendar", tags=["calendar"])


def _feed_url(request: Request, token: str) -> str:
    base = str(request.base_url).rstrip("/")
    return f"{base}/calendar/feed/{token}.ics"


@router.get("/subscription", response_model=CalendarSubscriptionOut)
async def get_subscription(
    request: Request, current_user: CurrentUser, session: SessionDep
) -> CalendarSubscriptionOut:
    token = await calendar_repo.ensure_calendar_token(session, user=current_user)
    return CalendarSubscriptionOut(url=_feed_url(request, token), token=token)


@router.post("/subscription/rotate", response_model=CalendarSubscriptionOut)
async def rotate_subscription(
    request: Request, current_user: CurrentUser, session: SessionDep
) -> CalendarSubscriptionOut:
    token = await calendar_repo.rotate_calendar_token(session, user=current_user)
    return CalendarSubscriptionOut(url=_feed_url(request, token), token=token)


@router.get("/feed/{token}.ics")
@limiter.limit("30/minute")
async def calendar_feed(request: Request, token: str, session: SessionDep) -> Response:
    # Public: calendar apps can't send an auth header, so the token is the
    # credential. Unknown token → 404 (no oracle on which tokens exist).
    user = await calendar_repo.get_user_by_calendar_token(session, token=token)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar not found")

    tasks = await calendar_repo.tasks_for_calendar(session, user_id=user.id)
    settings = get_settings()
    app_url = settings.cors_origins[0] if settings.cors_origins else ""
    body = ics.build_calendar(tasks, now=datetime.now(UTC), app_url=app_url)
    return Response(
        content=body,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'inline; filename="momentum.ics"'},
    )
