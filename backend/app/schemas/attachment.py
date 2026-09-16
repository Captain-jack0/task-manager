from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AttachmentConfig(BaseModel):
    max_bytes: int


class AttachmentOut(BaseModel):
    id: UUID
    task_id: UUID
    filename: str
    content_type: str
    size: int
    uploader_id: UUID | None = None
    uploader_email: str | None = None
    uploader_name: str | None = None
    created_at: datetime
