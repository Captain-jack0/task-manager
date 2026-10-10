from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, UploadFile, status
from fastapi.responses import StreamingResponse

from app.api.access import require_task
from app.api.deps import CurrentUser, SessionDep
from app.config import get_settings
from app.models.attachment import MAX_ATTACHMENT_BYTES, Attachment
from app.models.workspace import WorkspaceRole
from app.repositories import activity_repo, attachment_repo, workspace_repo
from app.schemas.attachment import AttachmentConfig, AttachmentOut
from app.services import storage

router = APIRouter(tags=["attachments"])

_MANAGERS = (WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
_MB = 1024 * 1024


def _max_bytes() -> int:
    return get_settings().attachment_max_mb * _MB if storage.enabled() else MAX_ATTACHMENT_BYTES


def _out(att: Attachment, email: str | None = None, name: str | None = None) -> AttachmentOut:
    return AttachmentOut(
        id=att.id,
        task_id=att.task_id,
        filename=att.filename,
        content_type=att.content_type,
        size=att.size,
        uploader_id=att.uploader_id,
        uploader_email=email,
        uploader_name=name,
        created_at=att.created_at,
    )


def _quota_bytes() -> int:
    return get_settings().attachment_quota_mb * _MB


@router.get("/attachments/config", response_model=AttachmentConfig)
async def attachment_config(current_user: CurrentUser, session: SessionDep) -> AttachmentConfig:
    """What the client may send: per-file cap (depends on whether object storage is
    on), the instance-wide quota and how much of it is used."""
    return AttachmentConfig(
        max_bytes=_max_bytes(),
        quota_bytes=_quota_bytes(),
        used_bytes=await attachment_repo.total_bytes(session),
    )


@router.get("/tasks/{task_id}/attachments", response_model=list[AttachmentOut])
async def list_attachments(
    task_id: UUID, current_user: CurrentUser, session: SessionDep
) -> list[AttachmentOut]:
    await require_task(session, current_user, task_id)
    rows = await attachment_repo.list_by_task(session, task_id=task_id)
    return [_out(a, email, name) for a, email, name in rows]


@router.post(
    "/tasks/{task_id}/attachments",
    response_model=AttachmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    task_id: UUID, file: UploadFile, current_user: CurrentUser, session: SessionDep
) -> AttachmentOut:
    await require_task(session, current_user, task_id, write=True)
    limit = _max_bytes()
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Attachments are limited to {limit // _MB} MB",
        )
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    quota = _quota_bytes()
    # ponytail: check-then-write; two simultaneous uploads can overshoot by one file.
    if quota and await attachment_repo.total_bytes(session) + len(data) > quota:
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail=f"Storage quota of {quota // 1024 // _MB} GB is full; remove some attachments first",
        )
    filename = (file.filename or "file")[:255]
    content_type = (file.content_type or "application/octet-stream")[:120]
    key: str | None = None
    if storage.enabled():
        # Object first, row second: a failed commit leaves an orphan object, never a
        # row that points at nothing.
        key = storage.new_key(task_id)
        await storage.put(key, data, content_type)
    att = await attachment_repo.create(
        session,
        task_id=task_id,
        uploader_id=current_user.id,
        filename=filename,
        content_type=content_type,
        size=len(data),
        data=None if key else data,
        storage_key=key,
    )
    await activity_repo.record(
        session, task_id=task_id, actor_id=current_user.id, field="attachment", new_value=filename
    )
    await session.commit()
    return _out(att, current_user.email, current_user.full_name)


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(
    attachment_id: UUID, current_user: CurrentUser, session: SessionDep
) -> Response:
    att = await attachment_repo.get(session, attachment_id=attachment_id, with_data=True)
    if att is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    await require_task(session, current_user, att.task_id)
    ascii_name = att.filename.encode("ascii", "replace").decode().replace('"', "")
    headers = {
        # Always a download, never rendered inline: an uploaded HTML/SVG must not run on our origin.
        "Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(att.filename)}",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
    }
    if att.storage_key:
        return StreamingResponse(
            await storage.open_stream(att.storage_key),
            media_type=att.content_type,
            headers={**headers, "Content-Length": str(att.size)},
        )
    return Response(content=att.data or b"", media_type=att.content_type, headers=headers)


@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attachment(
    attachment_id: UUID, current_user: CurrentUser, session: SessionDep
) -> None:
    att = await attachment_repo.get(session, attachment_id=attachment_id)
    if att is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    task = await require_task(session, current_user, att.task_id, write=True)
    if att.uploader_id != current_user.id:
        role = await workspace_repo.get_role(
            session, workspace_id=task.workspace_id, user_id=current_user.id
        )
        if role not in _MANAGERS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the uploader or an admin can delete this file",
            )
    await activity_repo.record(
        session,
        task_id=att.task_id,
        actor_id=current_user.id,
        field="attachment",
        old_value=att.filename,
    )
    key = att.storage_key
    await attachment_repo.delete(session, attachment=att)
    await session.commit()
    if key:
        await storage.delete_many([key])
