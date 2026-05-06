from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, SessionDep
from app.repositories import tag_repo
from app.schemas.tag import TagCreate, TagOut, TagUpdate

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagOut])
async def list_tags(current_user: CurrentUser, session: SessionDep) -> list[TagOut]:
    tags = await tag_repo.list_tags(session, user_id=current_user.id)
    return [TagOut.model_validate(t) for t in tags]


@router.post("", response_model=TagOut, status_code=status.HTTP_201_CREATED)
async def create_tag(
    payload: TagCreate, current_user: CurrentUser, session: SessionDep
) -> TagOut:
    tag = await tag_repo.create_tag(
        session, user_id=current_user.id, name=payload.name, color=payload.color
    )
    return TagOut.model_validate(tag)


@router.patch("/{tag_id}", response_model=TagOut)
async def update_tag(
    tag_id: UUID, payload: TagUpdate, current_user: CurrentUser, session: SessionDep
) -> TagOut:
    tag = await tag_repo.get_tag(session, tag_id=tag_id, user_id=current_user.id)
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    updated = await tag_repo.update_tag(
        session, tag=tag, name=payload.name, color=payload.color
    )
    return TagOut.model_validate(updated)


@router.delete("/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag(tag_id: UUID, current_user: CurrentUser, session: SessionDep) -> None:
    tag = await tag_repo.get_tag(session, tag_id=tag_id, user_id=current_user.id)
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    await tag_repo.delete_tag(session, tag=tag)
