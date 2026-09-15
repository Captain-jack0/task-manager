from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, UploadFile, status

from app.api.access import require_task
from app.api.deps import CurrentUser, SessionDep
from app.models.attachment import MAX_ATTACHMENT_BYTES, Attachment
from app.models.workspace import WorkspaceRole
from app.repositories import activity_repo, attachment_repo, workspace_repo
from app.schemas.attachment import AttachmentOut

router = APIRouter(tags=["attachments"])

_MANAGERS = (WorkspaceRole.OWNER, WorkspaceRole.ADMIN)


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
    data = await file.read(MAX_ATTACHMENT_BYTES + 1)
    if len(data) > MAX_ATTACHMENT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Attachments are limited to {MAX_ATTACHMENT_BYTES // (1024 * 1024)} MB",
        )
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    filename = (file.filename or "file")[:255]
    att = await attachment_repo.create(
        session,
        task_id=task_id,
        uploader_id=current_user.id,
        filename=filename,
        content_type=(file.content_type or "application/octet-stream")[:120],
        data=data,
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
    return Response(
        content=att.data,
        media_type=att.content_type,
        headers={
            # Always a download, never rendered inline: an uploaded HTML/SVG must not run on our origin.
            "Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(att.filename)}",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, no-store",
        },
    )


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
        session, task_id=att.task_id, actor_id=current_user.id, field="attachment", old_value=att.filename
    )
    await attachment_repo.delete(session, attachment=att)
    await session.commit()
