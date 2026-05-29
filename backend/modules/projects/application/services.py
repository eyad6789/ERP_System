"""Project use-cases. Clearance filtering happens HERE (server-side), never in the
UI — projects above the viewer's clearance are excluded from every query (FILTER
pattern, mirroring assets).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import Project


def visible_projects(user: Any) -> QuerySet[Project]:
    """Project queryset limited to records at or below the user's clearance."""
    return Project.objects.filter(classification__lte=user.clearance)


def filter_by_query(projects: QuerySet[Project], query: str) -> QuerySet[Project]:
    """Case-insensitive contains filter over the project's text fields."""
    return projects.filter(
        Q(name_ar__icontains=query) | Q(name_en__icontains=query) | Q(lead__icontains=query)
    )


def enforce_classification_ceiling(request: Request, classification: int, *, action: str) -> None:
    """Reject (403 + DENIED audit) an attempt to create/set a classification ABOVE
    the caller's own clearance. Mirrors enforce_object_clearance for write paths."""
    from modules.iam.application import public as iam

    user_clearance = getattr(request.user, "clearance", 0)
    if not iam.can_read_sensitivity(user_clearance, classification):
        iam.record_audit(
            request,
            action=action,
            target=f"Project:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting project counts (over-clearance rows are excluded)."""
    visible = visible_projects(user)
    return {
        "key": "projects",
        "total": visible.count(),
        "by_status": [
            {"status": status, "count": visible.filter(status=status).count()}
            for status in Project.Status.values
        ],
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over project text fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_projects(user).filter(
        Q(name_ar__icontains=query) | Q(name_en__icontains=query) | Q(lead__icontains=query)
    )[:limit]
    return [
        {
            "id": project.id,
            "kind": "project",
            "label_ar": project.name_ar,
            "label_en": project.name_en,
            "detail": f"{project.lead} · {project.get_status_display()} · {project.progress}%",
        }
        for project in matches
    ]


def serialize_detail(project: Project) -> dict[str, Any]:
    """Full project payload (only called after the clearance check passes)."""
    return {
        "id": project.id,
        "name_ar": project.name_ar,
        "name_en": project.name_en,
        "status": project.status,
        "progress": project.progress,
        "start_date": project.start_date.isoformat() if project.start_date else None,
        "end_date": project.end_date.isoformat() if project.end_date else None,
        "classification": project.classification,
        "lead": project.lead,
        "updated_at": project.updated_at.isoformat(),
    }


def create_project(data: dict[str, Any]) -> Project:
    """Persist a new project (clearance guard lives in the view)."""
    return Project.objects.create(**data)


def update_project(project: Project, data: dict[str, Any]) -> Project:
    """Apply a partial update to ``project`` (clearance guard lives in the view)."""
    for field, value in data.items():
        setattr(project, field, value)
    project.save()
    return project


def delete_project(project: Project) -> None:
    """Remove a project (clearance guard lives in the view)."""
    project.delete()
