from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.task import TaskEnergy, TaskPriority, TaskStatus
from app.schemas.tag import TagOut


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: datetime | None = None
    estimated_minutes: int | None = Field(default=None, ge=1, le=100_000)
    energy_level: TaskEnergy | None = None
    project_id: UUID | None = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("title cannot be empty")
        return v


class TaskCreate(TaskBase):
    tag_ids: list[UUID] = Field(default_factory=list)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: datetime | None = None
    estimated_minutes: int | None = Field(default=None, ge=1, le=100_000)
    energy_level: TaskEnergy | None = None
    project_id: UUID | None = None
    tag_ids: list[UUID] | None = None


class TaskOut(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    workspace_id: UUID
    snooze_count: int = 0
    github_issue_url: str | None = None
    github_issue_number: int | None = None
    tags: list[TagOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class TaskListResponse(BaseModel):
    data: list[TaskOut]
    total: int
    page: int
    limit: int


# --- "What should I do now?" suggestion engine ---


class TaskSuggestion(BaseModel):
    task: TaskOut
    score: float
    reason: str


class SuggestResponse(BaseModel):
    suggestions: list[TaskSuggestion]
