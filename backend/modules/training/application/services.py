"""Training use-cases. Clearance filtering happens HERE (server-side), never in
the UI — courses above the viewer's clearance are excluded from every query
(FILTER pattern, mirroring personnel).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import TrainingCourse


def visible_courses(user: Any) -> QuerySet[TrainingCourse]:
    """Course queryset limited to records at or below the user's clearance."""
    return TrainingCourse.objects.filter(classification__lte=user.clearance)


def filter_by_query(courses: QuerySet[TrainingCourse], query: str) -> QuerySet[TrainingCourse]:
    """Case-insensitive contains filter over the course's text fields."""
    return courses.filter(
        Q(title_ar__icontains=query) | Q(title_en__icontains=query) | Q(category__icontains=query)
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
            target=f"TrainingCourse:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting course counts (over-clearance rows are excluded)."""
    visible = visible_courses(user)
    return {
        "key": "training",
        "total": visible.count(),
        "by_status": [
            {"status": status, "count": visible.filter(status=status).count()}
            for status in TrainingCourse.Status.values
        ],
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over course text fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_courses(user).filter(
        Q(title_ar__icontains=query) | Q(title_en__icontains=query) | Q(category__icontains=query)
    )[:limit]
    return [
        {
            "id": course.id,
            "kind": "course",
            "label_ar": course.title_ar,
            "label_en": course.title_en,
            "detail": f"{course.category} · {course.hours}h · {course.status}",
        }
        for course in matches
    ]


def serialize_detail(course: TrainingCourse) -> dict[str, Any]:
    """Full course payload (only called after the clearance check passes)."""
    return {
        "id": course.id,
        "title_ar": course.title_ar,
        "title_en": course.title_en,
        "category": course.category,
        "hours": course.hours,
        "status": course.status,
        "classification": course.classification,
        "updated_at": course.updated_at.isoformat(),
    }
