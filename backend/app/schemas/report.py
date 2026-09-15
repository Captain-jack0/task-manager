from datetime import date
from uuid import UUID

from pydantic import BaseModel


class DayPointOut(BaseModel):
    day: date
    completed: int
    created: int


class PersonRowOut(BaseModel):
    user_id: UUID
    email: str
    full_name: str | None = None
    open: int
    overdue: int
    completed: int
    estimated_open_minutes: int
    logged_minutes: int


class SprintSnapshotOut(BaseModel):
    id: UUID
    name: str
    end_date: date
    total: int
    finished: int


class DashboardOut(BaseModel):
    days: int
    open: int
    overdue: int
    completed: int
    created: int
    by_status: dict[str, int]
    per_day: list[DayPointOut]
    people: list[PersonRowOut]
    active_sprint: SprintSnapshotOut | None = None
