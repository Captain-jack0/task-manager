from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, SessionDep
from app.config import get_settings
from app.core.rate_limit import limiter
from app.core.security import (
    create_access_token,
    create_password_reset_token,
    decode_password_reset_token,
    hash_password,
    password_fingerprint,
    verify_password,
)
from app.models.user import User
from app.repositories import workspace_repo
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.user import UserOut
from app.services import mailer

router = APIRouter(prefix="/auth", tags=["auth"])


async def _user_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id), user=UserOut.model_validate(user)
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
async def register(
    request: Request, payload: RegisterRequest, session: SessionDep
) -> TokenResponse:
    if await _user_by_email(session, payload.email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        )

    user = User(email=payload.email.lower(), password_hash=hash_password(payload.password))
    session.add(user)
    await session.flush()

    # Every user starts with a private personal workspace.
    await workspace_repo.create_workspace(
        session, name="Personal", owner_id=user.id, is_personal=True
    )
    await session.commit()
    await session.refresh(user)
    return _token_response(user)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request, payload: LoginRequest, session: SessionDep
) -> TokenResponse:
    user = await _user_by_email(session, payload.email)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return _token_response(user)


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    session: SessionDep,
    background: BackgroundTasks,
) -> dict[str, str]:
    # Same reply whether or not the address is registered, and the mail goes
    # out after the response — nothing here lets a caller enumerate accounts.
    user = await _user_by_email(session, payload.email)
    if user is not None:
        token = create_password_reset_token(user.id, user.password_hash)
        link = f"{get_settings().public_app_url}/reset-password?token={token}"
        background.add_task(mailer.send_password_reset, user.email, link)
    return {"detail": "If that email is registered, a reset link is on its way."}


@router.post("/reset-password", response_model=TokenResponse)
@limiter.limit("10/minute")
async def reset_password(
    request: Request, payload: ResetPasswordRequest, session: SessionDep
) -> TokenResponse:
    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="This reset link is invalid or has expired",
    )
    try:
        claims = decode_password_reset_token(payload.token)
        user_id = UUID(claims["sub"])
    except (ValueError, KeyError) as exc:
        raise invalid from exc

    user = await session.get(User, user_id)
    if user is None or claims.get("pwf") != password_fingerprint(user.password_hash):
        raise invalid

    user.password_hash = hash_password(payload.password)
    await session.commit()
    await session.refresh(user)
    return _token_response(user)


@router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUser) -> UserOut:
    return UserOut.model_validate(current_user)
