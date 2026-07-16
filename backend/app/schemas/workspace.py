from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.workspace import Workspace, WorkspaceRole


class MemberOut(BaseModel):
    user_id: UUID
    email: str
    role: WorkspaceRole


class AddMemberRequest(BaseModel):
    email: EmailStr
    role: WorkspaceRole = WorkspaceRole.MEMBER


class UpdateMemberRequest(BaseModel):
    role: WorkspaceRole


class CapacityOut(BaseModel):
    user_id: UUID
    email: str
    role: WorkspaceRole
    open_task_count: int
    estimated_minutes: int


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name cannot be empty")
        return v


class WorkspaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    is_personal: bool
    role: WorkspaceRole
    created_at: datetime

    @classmethod
    def of(cls, workspace: Workspace, role: WorkspaceRole) -> "WorkspaceOut":
        return cls(
            id=workspace.id,
            name=workspace.name,
            is_personal=workspace.is_personal,
            role=role,
            created_at=workspace.created_at,
        )
