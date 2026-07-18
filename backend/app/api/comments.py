from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.access import require_task
from app.api.deps import CurrentUser, SessionDep
from app.models.workspace import WorkspaceRole
from app.repositories import comment_repo, workspace_repo
from app.schemas.comment import CommentCreate, CommentOut

router = APIRouter(prefix="/tasks", tags=["comments"])

_MANAGERS = (WorkspaceRole.OWNER, WorkspaceRole.ADMIN)


@router.get("/{task_id}/comments", response_model=list[CommentOut])
async def list_comments(
    task_id: UUID, current_user: CurrentUser, session: SessionDep
) -> list[CommentOut]:
    await require_task(session, current_user, task_id)
    rows = await comment_repo.list_by_task(session, task_id=task_id)
    return [
        CommentOut(
            id=c.id,
            task_id=c.task_id,
            author_id=c.author_id,
            author_email=email,
            body=c.body,
            created_at=c.created_at,
        )
        for c, email in rows
    ]


@router.post(
    "/{task_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED
)
async def create_comment(
    task_id: UUID,
    payload: CommentCreate,
    current_user: CurrentUser,
    session: SessionDep,
) -> CommentOut:
    await require_task(session, current_user, task_id, write=True)
    comment = await comment_repo.create(
        session, task_id=task_id, author_id=current_user.id, body=payload.body
    )
    return CommentOut(
        id=comment.id,
        task_id=comment.task_id,
        author_id=comment.author_id,
        author_email=current_user.email,
        body=comment.body,
        created_at=comment.created_at,
    )


@router.delete(
    "/{task_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_comment(
    task_id: UUID,
    comment_id: UUID,
    current_user: CurrentUser,
    session: SessionDep,
) -> None:
    task = await require_task(session, current_user, task_id, write=True)
    comment = await comment_repo.get(session, comment_id=comment_id)
    if comment is None or comment.task_id != task_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    if comment.author_id != current_user.id:
        role = await workspace_repo.get_role(
            session, workspace_id=task.workspace_id, user_id=current_user.id
        )
        if role not in _MANAGERS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the author or an admin can delete this comment",
            )
    await comment_repo.delete(session, comment=comment)
