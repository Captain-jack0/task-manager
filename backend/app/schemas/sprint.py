from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class SprintCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    goal: str | None = Field(default=None, max_length=2000)
    start_date: date
    end_date: date

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name cannot be empty")
        return v

    @model_validator(mode="after")
    def _end_after_start(self) -> "SprintCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self


class SprintUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    goal: str | None = Field(default=None, max_length=2000)
    start_date: date | None = None
    end_date: date | None = None


class SprintOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    name: str
    goal: str | None = None
    start_date: date
    end_date: date
    # Progress, filled in by the list endpoint.
    task_count: int = 0
    done_count: int = 0
    created_at: datetime
