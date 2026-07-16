from pydantic import BaseModel, Field, field_validator


class GithubConnectRequest(BaseModel):
    token: str = Field(min_length=10, max_length=255)
    repo: str = Field(min_length=3, max_length=140)

    @field_validator("token")
    @classmethod
    def strip_token(cls, v: str) -> str:
        return v.strip()

    @field_validator("repo")
    @classmethod
    def validate_repo(cls, v: str) -> str:
        v = v.strip()
        parts = v.split("/")
        if len(parts) != 2 or not all(parts):
            raise ValueError("repo must be in the form owner/repo")
        return v


class GithubStatusOut(BaseModel):
    connected: bool
    repo: str | None = None
