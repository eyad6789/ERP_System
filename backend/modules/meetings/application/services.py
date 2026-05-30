"""Meeting use-cases. Clearance filtering happens HERE (server-side), never in
the UI — meetings above the viewer's clearance are excluded from every query
(FILTER pattern, mirroring personnel).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import Meeting


def visible_meetings(user: Any) -> QuerySet[Meeting]:
    """Meeting queryset limited to records at or below the user's clearance."""
    return Meeting.objects.filter(classification__lte=user.clearance)


def filter_by_query(meetings: QuerySet[Meeting], query: str) -> QuerySet[Meeting]:
    """Case-insensitive contains filter over the meeting's text fields."""
    return meetings.filter(
        Q(title_ar__icontains=query) | Q(title_en__icontains=query) | Q(location__icontains=query)
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
            target=f"Meeting:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting meeting counts (over-clearance rows are excluded)."""
    visible = visible_meetings(user)
    return {
        "key": "meetings",
        "total": visible.count(),
        "scheduled": visible.filter(status=Meeting.Status.SCHEDULED).count(),
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over meeting text fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_meetings(user).filter(
        Q(title_ar__icontains=query) | Q(title_en__icontains=query) | Q(location__icontains=query)
    )[:limit]
    return [
        {
            "id": meeting.id,
            "kind": "meeting",
            "label_ar": meeting.title_ar,
            "label_en": meeting.title_en,
            "detail": f"{meeting.location} · {meeting.status}",
        }
        for meeting in matches
    ]


def serialize_detail(meeting: Meeting) -> dict[str, Any]:
    """Full meeting payload (only called after the clearance check passes)."""
    return {
        "id": meeting.id,
        "title_ar": meeting.title_ar,
        "title_en": meeting.title_en,
        "start_at": meeting.start_at.isoformat(),
        "end_at": meeting.end_at.isoformat(),
        "location": meeting.location,
        "status": meeting.status,
        "classification": meeting.classification,
        "updated_at": meeting.updated_at.isoformat(),
    }
