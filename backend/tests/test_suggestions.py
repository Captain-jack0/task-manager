"""Unit tests for the 'What should I do now?' scoring engine (pure functions)."""
from datetime import UTC, datetime, timedelta

from app.models.task import Task, TaskEnergy, TaskPriority
from app.services.suggestions import rank_tasks, score_task

NOW = datetime(2026, 7, 15, 12, 0, tzinfo=UTC)


def _task(**kw) -> Task:
    defaults = {
        "title": "t",
        "priority": TaskPriority.MEDIUM,
        "estimated_minutes": None,
        "energy_level": None,
        "due_date": None,
    }
    defaults.update(kw)
    return Task(**defaults)


def test_excludes_tasks_that_do_not_fit_the_time() -> None:
    task = _task(estimated_minutes=90)
    assert score_task(task, available_minutes=30, energy=None, now=NOW) is None


def test_included_when_estimate_unknown() -> None:
    task = _task(estimated_minutes=None)
    assert score_task(task, available_minutes=30, energy=None, now=NOW) is not None


def test_energy_match_outranks_too_demanding() -> None:
    match = _task(energy_level=TaskEnergy.LOW, estimated_minutes=10)
    too_demanding = _task(energy_level=TaskEnergy.HIGH, estimated_minutes=10)
    ranked = rank_tasks(
        [too_demanding, match], available_minutes=30, energy=TaskEnergy.LOW, now=NOW
    )
    assert ranked[0][0] is match


def test_overdue_high_priority_ranks_first() -> None:
    overdue = _task(
        priority=TaskPriority.HIGH,
        due_date=NOW - timedelta(days=2),
        estimated_minutes=10,
    )
    later = _task(
        priority=TaskPriority.LOW,
        due_date=NOW + timedelta(days=10),
        estimated_minutes=10,
    )
    ranked = rank_tasks([later, overdue], available_minutes=60, energy=None, now=NOW)
    assert ranked[0][0] is overdue


def test_limit_is_respected() -> None:
    tasks = [_task(estimated_minutes=5) for _ in range(10)]
    ranked = rank_tasks(tasks, available_minutes=60, energy=None, now=NOW, limit=3)
    assert len(ranked) == 3
