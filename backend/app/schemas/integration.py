import re

from pydantic import BaseModel, Field, field_validator

# owner/repo with only GitHub-legal characters — blocks spaces, extra slashes,
# and path-traversal like "a/.." before it ever reaches the GitHub URL.
_REPO_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9._-]+")


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
        if not _REPO_RE.fullmatch(v):
            raise ValueError("repo must be in the form owner/repo")
        return v


class GithubStatusOut(BaseModel):
    connected: bool
    repo: str | None = None
