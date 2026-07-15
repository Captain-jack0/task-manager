"""The 'What should I do now?' engine.

Scores candidate tasks against how much time and energy the user has right
now, blending three dimensions: urgency (priority + due date), how well the
task fits the available time, and whether it matches the user's energy. Pure
functions — no I/O — so they are trivial to unit test.
"""
from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from app.models.task import Task, TaskEnergy, TaskPriority

_PRIORITY_WEIGHT: dict[TaskPriority, float] = {
    TaskPriority.LOW: 1.0,
    TaskPriority.MEDIUM: 2.0,
    TaskPriority.HIGH: 3.0,
}

_ENERGY_RANK: dict[TaskEnergy, int] = {
    TaskEnergy.LOW: 1,
    TaskEnergy.MEDIUM: 2,
    TaskEnergy.HIGH: 3,
}


def score_task(
    task: Task,
    *,
    available_minutes: int | None,
    energy: TaskEnergy | None,
    now: datetime,
) -> tuple[float, str] | None:
    """Return (score, reason) for a task, or None if it can't be done now.

    A task is excluded only when its estimated time clearly won't fit the
    window the user has.
    """
    est = task.estimated_minutes
    if est is not None and available_minutes is not None and est > available_minutes:
        return None

    score = 0.0
    reasons: list[str] = []

    # Urgency — priority always counts; due date adds weight as it approaches.
    score += _PRIORITY_WEIGHT[task.priority] * 2
    if task.priority is TaskPriority.HIGH:
        reasons.append("high priority")
    if task.due_date is not None:
        days = (task.due_date.date() - now.date()).days
        if days < 0:
            score += 6
            reasons.append("overdue")
        elif days == 0:
            score += 5
            reasons.append("due today")
        elif days <= 2:
            score += 3
            reasons.append("due soon")
        elif days <= 7:
            score += 1

    # Energy fit — never suggest something too demanding for how the user feels.
    if energy is not None and task.energy_level is not None:
        need = _ENERGY_RANK[task.energy_level]
        have = _ENERGY_RANK[energy]
        if need <= have:
            score += 2
            if need == have:
                score += 1
                reasons.append("matches your energy")
        else:
            score -= 4
            reasons.append("needs more energy")

    # Time fit — reward tasks that use the window well.
    if est is not None and available_minutes:
        ratio = est / available_minutes
        if 0.4 <= ratio <= 1.0:
            score += 2
            reasons.append("fits your time")
        else:
            score += 1
    elif est is not None:
        reasons.append(f"~{est} min")

    reason = ", ".join(dict.fromkeys(reasons)) or "a good next step"
    return score, reason


def rank_tasks(
    tasks: Sequence[Task],
    *,
    available_minutes: int | None,
    energy: TaskEnergy | None,
    now: datetime,
    limit: int = 5,
) -> list[tuple[Task, float, str]]:
    """Score, filter and sort candidate tasks; best first."""
    scored: list[tuple[Task, float, str]] = []
    for task in tasks:
        result = score_task(
            task, available_minutes=available_minutes, energy=energy, now=now
        )
        if result is None:
            continue
        score, reason = result
        scored.append((task, score, reason))

    scored.sort(key=lambda item: item[1], reverse=True)
    return scored[:limit]
