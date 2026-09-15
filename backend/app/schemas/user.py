from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _clean_name(v: str | None) -> str | None:
    v = (v or "").strip()
    return v or None


class UserBase(BaseModel):
    email: EmailStr


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str | None = None
    created_at: datetime


class ProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=120)

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, v: str | None) -> str | None:
        return _clean_name(v)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
