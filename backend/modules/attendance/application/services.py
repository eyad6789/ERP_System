"""Attendance use-cases. Clearance filtering happens HERE (server-side), never in
the UI — records above the viewer's clearance are excluded from every query
(FILTER pattern, mirroring personnel).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import AttendanceRecord


def visible_records(user: Any) -> QuerySet[AttendanceRecord]:
    """Record queryset limited to entries at or below the user's clearance."""
    return AttendanceRecord.objects.filter(classification__lte=user.clearance)


def filter_by_query(records: QuerySet[AttendanceRecord], query: str) -> QuerySet[AttendanceRecord]:
    """Case-insensitive contains filter over the record's text fields."""
    return records.filter(
        Q(employee__icontains=query)
        | Q(status__icontains=query)
        | Q(check_in__icontains=query)
        | Q(check_out__icontains=query)
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
            target=f"AttendanceRecord:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting attendance counts (over-clearance rows are excluded)."""
    visible = visible_records(user)
    return {
        "key": "attendance",
        "total": visible.count(),
        "by_status": [
            {"status": status, "count": visible.filter(status=status).count()}
            for status in AttendanceRecord.Status.values
        ],
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over record text fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_records(user).filter(
        Q(employee__icontains=query)
        | Q(status__icontains=query)
        | Q(check_in__icontains=query)
        | Q(check_out__icontains=query)
    )[:limit]
    return [
        {
            "id": record.id,
            "kind": "attendance",
            "label_ar": record.employee,
            "label_en": record.employee,
            "detail": f"{record.date} · {record.status}",
        }
        for record in matches
    ]


def serialize_detail(record: AttendanceRecord) -> dict[str, Any]:
    """Full record payload (only called after the clearance check passes)."""
    return {
        "id": record.id,
        "employee": record.employee,
        "date": record.date.isoformat(),
        "status": record.status,
        "check_in": record.check_in,
        "check_out": record.check_out,
        "classification": record.classification,
        "updated_at": record.updated_at.isoformat(),
    }
