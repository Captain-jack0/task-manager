from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, SessionDep
from app.repositories import notification_repo
from app.schemas.notification import NotificationList, NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


async def _listing(session: SessionDep, user_id: UUID, *, unread_only: bool, limit: int) -> NotificationList:
    items = await notification_repo.list_for_user(
        session, user_id=user_id, unread_only=unread_only, limit=limit
    )
    unread = await notification_repo.unread_count(session, user_id=user_id)
    return NotificationList(items=[NotificationOut.model_validate(n) for n in items], unread=unread)


@router.get("", response_model=NotificationList)
async def list_notifications(
    current_user: CurrentUser,
    session: SessionDep,
    unread_only: bool = False,
    limit: int = Query(default=30, ge=1, le=100),
) -> NotificationList:
    return await _listing(session, current_user.id, unread_only=unread_only, limit=limit)


@router.post("/read-all", response_model=NotificationList)
async def read_all(current_user: CurrentUser, session: SessionDep) -> NotificationList:
    await notification_repo.mark_all_read(session, user_id=current_user.id)
    return await _listing(session, current_user.id, unread_only=False, limit=30)


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def read_one(
    notification_id: UUID, current_user: CurrentUser, session: SessionDep
) -> NotificationOut:
    note = await notification_repo.get_for_user(
        session, user_id=current_user.id, notification_id=notification_id
    )
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return NotificationOut.model_validate(await notification_repo.mark_read(session, note=note))
