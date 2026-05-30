"""Event use-cases. Clearance filtering happens HERE (server-side), never in the
UI — events above the viewer's clearance are excluded from every query (FILTER
pattern, mirroring assets).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import Event


def visible_events(user: Any) -> QuerySet[Event]:
    """Event queryset limited to records at or below the user's clearance."""
    return Event.objects.filter(classification__lte=user.clearance)


def filter_by_query(events: QuerySet[Event], query: str) -> QuerySet[Event]:
    """Case-insensitive contains filter over the event's text fields."""
    return events.filter(
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
            target=f"Event:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting event counts (over-clearance rows are excluded)."""
    visible = visible_events(user)
    return {
        "key": "events",
        "total": visible.count(),
        "by_type": [
            {"event_type": event_type, "count": visible.filter(event_type=event_type).count()}
            for event_type in Event.EventType.values
        ],
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over event text fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_events(user).filter(
        Q(title_ar__icontains=query) | Q(title_en__icontains=query)
    )[:limit]
    return [
        {
            "id": event.id,
            "kind": "event",
            "label_ar": event.title_ar,
            "label_en": event.title_en,
            "detail": f"{event.event_type} · {event.start_at.isoformat()}",
        }
        for event in matches
    ]


def serialize_detail(event: Event) -> dict[str, Any]:
    """Full event payload (only called after the clearance check passes)."""
    return {
        "id": event.id,
        "title_ar": event.title_ar,
        "title_en": event.title_en,
        "start_at": event.start_at.isoformat(),
        "end_at": event.end_at.isoformat(),
        "event_type": event.event_type,
        "location": event.location,
        "classification": event.classification,
        "updated_at": event.updated_at.isoformat(),
    }
