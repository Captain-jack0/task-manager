from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.user import UserOut


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    # Optional so older clients (mobile) keep working; the web form requires it.
    full_name: str | None = Field(default=None, max_length=120)

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, v: str | None) -> str | None:
        v = (v or "").strip()
        return v or None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=1, max_length=2048)
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
