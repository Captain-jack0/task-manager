from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ActivityActor(BaseModel):
    id: UUID
    email: str
    full_name: str | None = None


class TaskEventOut(BaseModel):
    id: UUID
    field: str
    old_value: str | None = None
    new_value: str | None = None
    actor: ActivityActor | None = None
    created_at: datetime
