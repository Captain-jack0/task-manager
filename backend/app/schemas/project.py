from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.integration import normalise_repo


def _optional_repo(v: str | None) -> str | None:
    if v is None or not v.strip():
        return None
    return normalise_repo(v)


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    color: str | None = Field(default=None, max_length=7)
    github_repo: str | None = Field(default=None, max_length=140)
    auto_test: bool = False

    @field_validator("github_repo")
    @classmethod
    def validate_repo(cls, v: str | None) -> str | None:
        return _optional_repo(v)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name cannot be empty")
        return v


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    color: str | None = Field(default=None, max_length=7)
    github_repo: str | None = Field(default=None, max_length=140)
    auto_test: bool | None = None

    @field_validator("github_repo")
    @classmethod
    def validate_repo(cls, v: str | None) -> str | None:
        return _optional_repo(v)


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    name: str
    color: str | None = None
    github_repo: str | None = None
    auto_test: bool = False
    created_at: datetime
