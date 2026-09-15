from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class TimeEntryOut(BaseModel):
    id: UUID
    task_id: UUID
    user_id: UUID
    user_email: str | None = None
    user_name: str | None = None
    started_at: datetime
    ended_at: datetime | None = None
    minutes: int
    note: str | None = None


class TimeEntryCreate(BaseModel):
    """A finished block of work logged by hand."""

    started_at: datetime
    ended_at: datetime
    note: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def _end_after_start(self) -> "TimeEntryCreate":
        if self.ended_at <= self.started_at:
            raise ValueError("ended_at must be after started_at")
        if (self.ended_at - self.started_at).total_seconds() > 24 * 3600:
            raise ValueError("a single entry cannot exceed 24 hours")
        return self


class TaskTime(BaseModel):
    entries: list[TimeEntryOut]
    total_minutes: int
    running: TimeEntryOut | None = None


class RunningTimer(BaseModel):
    entry: TimeEntryOut
    task_title: str


class TimeReportRow(BaseModel):
    task_id: UUID
    task_title: str
    user_id: UUID
    user_email: str
    user_name: str | None = None
    minutes: int


class TimeReport(BaseModel):
    start_at: datetime
    end_at: datetime
    rows: list[TimeReportRow]
    total_minutes: int
