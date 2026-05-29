"""Operations use-cases. Clearance filtering happens HERE (server-side), never in
the UI — tasks above the viewer's clearance are excluded from every query.
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet

from modules.iam.application import public as iam

from ..infrastructure.models import Task


def visible_tasks(user: Any) -> QuerySet[Task]:
    """Board queryset limited to tasks at or below the user's clearance."""
    return Task.objects.filter(classification__lte=user.clearance)


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting task counts for the operations dashboard tile."""
    tasks = visible_tasks(user)
    counts = dict.fromkeys(Task.Status.values, 0)
    for status in tasks.values_list("status", flat=True):
        if status in counts:
            counts[status] += 1
    return {
        "key": "operations",
        "total": tasks.count(),
        "by_status": [{"status": status, "count": counts[status]} for status in Task.Status.values],
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive, clearance-respecting search over task text fields."""
    query = query.strip()
    if not query:
        return []
    matches = visible_tasks(user).filter(
        Q(title_ar__icontains=query) | Q(title_en__icontains=query) | Q(assignee__icontains=query)
    )
    results: list[dict[str, Any]] = []
    for task in matches:
        if not iam.can_read_sensitivity(user.clearance, task.classification):
            continue
        results.append(
            {
                "id": task.id,
                "kind": "operation",
                "label_ar": task.title_ar,
                "label_en": task.title_en,
                "detail": f"{task.assignee or '—'} · {task.status} · {task.priority}",
            }
        )
        if len(results) >= limit:
            break
    return results


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
