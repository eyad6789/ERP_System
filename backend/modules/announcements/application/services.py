"""Announcement use-cases. Clearance filtering happens HERE (server-side), never
in the UI — announcements above the viewer's clearance are excluded from every
query (FILTER pattern, mirroring personnel).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import Announcement


def visible_announcements(user: Any) -> QuerySet[Announcement]:
    """Announcement queryset limited to records at or below the user's clearance."""
    return Announcement.objects.filter(classification__lte=user.clearance)


def filter_by_query(announcements: QuerySet[Announcement], query: str) -> QuerySet[Announcement]:
    """Case-insensitive contains filter over the announcement's text fields."""
    return announcements.filter(
        Q(title_ar__icontains=query) | Q(title_en__icontains=query) | Q(body__icontains=query)
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
            target=f"Announcement:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting announcement counts (over-clearance rows excluded)."""
    visible = visible_announcements(user)
    return {
        "key": "announcements",
        "total": visible.count(),
        "by_audience": [
            {"audience": audience, "count": visible.filter(audience=audience).count()}
            for audience in visible.values_list("audience", flat=True).distinct()
        ],
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over announcement text fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_announcements(user).filter(
        Q(title_ar__icontains=query) | Q(title_en__icontains=query) | Q(body__icontains=query)
    )[:limit]
    return [
        {
            "id": announcement.id,
            "kind": "announcement",
            "label_ar": announcement.title_ar,
            "label_en": announcement.title_en,
            "detail": f"{announcement.audience} · {announcement.published_date.isoformat()}",
        }
        for announcement in matches
    ]


def serialize_detail(announcement: Announcement) -> dict[str, Any]:
    """Full announcement payload (only called after the clearance check passes)."""
    return {
        "id": announcement.id,
        "title_ar": announcement.title_ar,
        "title_en": announcement.title_en,
        "body": announcement.body,
        "audience": announcement.audience,
        "published_date": announcement.published_date.isoformat(),
        "classification": announcement.classification,
        "updated_at": announcement.updated_at.isoformat(),
    }
