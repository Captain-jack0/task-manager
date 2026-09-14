"""Task-to-task links and the status rules that follow from `blocks` edges.

Rule: a task with at least one unfinished blocker is `blocked`; when its last
open blocker finishes (done/closed) it returns to `todo`. Manual status changes
on the blocked task itself are never overridden here.
"""
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.models.task import Task, TaskStatus
from app.models.task_link import LinkKind, TaskLink

FINISHED = (TaskStatus.DONE, TaskStatus.CLOSED)
OPEN = (TaskStatus.TODO, TaskStatus.IN_PROGRESS)


async def get(session: AsyncSession, *, link_id: UUID) -> TaskLink | None:
    return await session.get(TaskLink, link_id)


async def find(
    session: AsyncSession, *, source_id: UUID, target_id: UUID, kind: LinkKind
) -> TaskLink | None:
    """The link itself, or its mirror for the symmetric `relates` kind."""
    pairs = [(source_id, target_id)]
    if kind == LinkKind.RELATES:
        pairs.append((target_id, source_id))
    result = await session.execute(
        select(TaskLink).where(
            TaskLink.kind == kind,
            or_(*[(TaskLink.source_id == s) & (TaskLink.target_id == t) for s, t in pairs]),
        )
    )
    return result.scalars().first()


async def summaries(
    session: AsyncSession, *, task_ids: Sequence[UUID]
) -> dict[UUID, dict[str, list[dict[str, object]]]]:
    """{task_id: {"blocked_by": [...], "blocks": [...], "related": [...]}} for the given tasks.

    Each entry is a lightweight ref of the *other* task: link_id, id, title, status.
    One query for any number of tasks, so list endpoints stay at O(1) extra queries.
    """
    if not task_ids:
        return {}
    src, tgt = aliased(Task), aliased(Task)
    rows = await session.execute(
        select(TaskLink, src.id, src.title, src.status, tgt.id, tgt.title, tgt.status)
        .join(src, TaskLink.source_id == src.id)
        .join(tgt, TaskLink.target_id == tgt.id)
        .where(or_(TaskLink.source_id.in_(task_ids), TaskLink.target_id.in_(task_ids)))
        .order_by(TaskLink.created_at)
    )
    wanted = set(task_ids)
    out: dict[UUID, dict[str, list[dict[str, object]]]] = {
        tid: {"blocked_by": [], "blocks": [], "related": []} for tid in task_ids
    }
    for link, s_id, s_title, s_status, t_id, t_title, t_status in rows.all():
        source_ref = {"link_id": link.id, "id": s_id, "title": s_title, "status": s_status}
        target_ref = {"link_id": link.id, "id": t_id, "title": t_title, "status": t_status}
        if s_id in wanted:
            out[s_id]["blocks" if link.kind == LinkKind.BLOCKS else "related"].append(target_ref)
        if t_id in wanted:
            out[t_id]["blocked_by" if link.kind == LinkKind.BLOCKS else "related"].append(source_ref)
    return out


async def open_blockers(session: AsyncSession, *, task_id: UUID) -> int:
    result = await session.execute(
        select(TaskLink.id)
        .join(Task, TaskLink.source_id == Task.id)
        .where(
            TaskLink.target_id == task_id,
            TaskLink.kind == LinkKind.BLOCKS,
            Task.status.not_in(FINISHED),
        )
    )
    return len(result.all())


async def dependents(session: AsyncSession, *, blocker_id: UUID) -> Sequence[Task]:
    """Tasks that `blocker_id` blocks."""
    result = await session.execute(
        select(Task)
        .join(TaskLink, TaskLink.target_id == Task.id)
        .where(TaskLink.source_id == blocker_id, TaskLink.kind == LinkKind.BLOCKS)
    )
    return result.scalars().unique().all()


async def release_if_unblocked(session: AsyncSession, task: Task) -> None:
    """blocked → todo once no unfinished blocker remains. Does not commit."""
    # The session has autoflush off: push pending status edits first so the
    # blocker query below sees them instead of the last committed state.
    await session.flush()
    if task.status == TaskStatus.BLOCKED and await open_blockers(session, task_id=task.id) == 0:
        task.status = TaskStatus.TODO


async def propagate_blocker_status(session: AsyncSession, blocker: Task) -> None:
    """Called after `blocker`'s status changed: finishing releases its dependents,
    reopening blocks them again. Does not commit."""
    await session.flush()
    for dependent in await dependents(session, blocker_id=blocker.id):
        if blocker.status in FINISHED:
            await release_if_unblocked(session, dependent)
        elif dependent.status in OPEN:
            dependent.status = TaskStatus.BLOCKED
