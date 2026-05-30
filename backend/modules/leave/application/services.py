"""Leave use-cases. Clearance filtering happens HERE (server-side), never in the
UI — requests above the viewer's clearance are excluded from every query (FILTER
pattern, mirroring assets/personnel).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import LeaveRequest


def visible_requests(user: Any) -> QuerySet[LeaveRequest]:
    """LeaveRequest queryset limited to records at or below the user's clearance."""
    return LeaveRequest.objects.filter(classification__lte=user.clearance)


def filter_by_query(requests: QuerySet[LeaveRequest], query: str) -> QuerySet[LeaveRequest]:
    """Case-insensitive contains filter over the request's text fields."""
    return requests.filter(
        Q(employee__icontains=query)
        | Q(leave_type__icontains=query)
        | Q(status__icontains=query)
        | Q(reason__icontains=query)
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
            target=f"LeaveRequest:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting leave counts (over-clearance rows are excluded)."""
    visible = visible_requests(user)
    return {
        "key": "leave",
        "total": visible.count(),
        "pending": visible.filter(status=LeaveRequest.Status.PENDING).count(),
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over leave text fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_requests(user).filter(
        Q(employee__icontains=query)
        | Q(leave_type__icontains=query)
        | Q(status__icontains=query)
        | Q(reason__icontains=query)
    )[:limit]
    return [
        {
            "id": req.id,
            "kind": "leave",
            "label_ar": req.employee,
            "label_en": req.employee,
            "detail": f"{req.leave_type} · {req.status} · {req.start_date}",
        }
        for req in matches
    ]


def serialize_detail(req: LeaveRequest) -> dict[str, Any]:
    """Full leave-request payload (only called after the clearance check passes)."""
    return {
        "id": req.id,
        "employee": req.employee,
        "leave_type": req.leave_type,
        "start_date": req.start_date.isoformat(),
        "end_date": req.end_date.isoformat(),
        "status": req.status,
        "reason": req.reason,
        "classification": req.classification,
        "updated_at": req.updated_at.isoformat(),
    }
