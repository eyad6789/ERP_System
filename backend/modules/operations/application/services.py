"""Operations use-cases. Clearance filtering happens HERE (server-side), never in
the UI — tasks above the viewer's clearance are excluded from every query.
"""

from __future__ import annotations

from typing import Any

from django.db.models import QuerySet

from ..infrastructure.models import Task


def visible_tasks(user: Any) -> QuerySet[Task]:
    """Board queryset limited to tasks at or below the user's clearance."""
    return Task.objects.filter(classification__lte=user.clearance)


def serialize_task(task: Task) -> dict[str, Any]:
    """Single task payload (only after the clearance check passes for detail)."""
    return {
        "id": task.id,
        "title_ar": task.title_ar,
        "title_en": task.title_en,
        "assignee": task.assignee,
        "priority": task.priority,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "status": task.status,
        "classification": task.classification,
        "updated_at": task.updated_at.isoformat(),
    }
