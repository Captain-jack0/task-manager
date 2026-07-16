from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5_000)

    @field_validator("body")
    @classmethod
    def strip_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("comment cannot be empty")
        return v


class CommentOut(BaseModel):
    id: UUID
    task_id: UUID
    author_id: UUID
    author_email: str
    body: str
    created_at: datetime
