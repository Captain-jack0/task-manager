from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.notification import NotificationKind


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: NotificationKind
    message: str
    task_id: UUID | None = None
    actor_id: UUID | None = None
    read_at: datetime | None = None
    created_at: datetime


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread: int
