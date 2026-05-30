"""Compliance use-cases. Clearance filtering happens HERE (server-side), never in
the UI — compliance items above the viewer's clearance are excluded from every query
(FILTER pattern, mirroring personnel).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import ComplianceItem


def visible_items(user: Any) -> QuerySet[ComplianceItem]:
    """ComplianceItem queryset limited to records at or below the user's clearance."""
    return ComplianceItem.objects.filter(classification__lte=user.clearance)


def filter_by_query(items: QuerySet[ComplianceItem], query: str) -> QuerySet[ComplianceItem]:
    """Case-insensitive contains filter over the item's text fields."""
    return items.filter(
        Q(title_ar__icontains=query)
        | Q(title_en__icontains=query)
        | Q(standard__icontains=query)
        | Q(finding__icontains=query)
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
            target=f"ComplianceItem:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting compliance counts (over-clearance rows are excluded)."""
    visible = visible_items(user)
    return {
        "key": "compliance",
        "total": visible.count(),
        "non_compliant": visible.filter(status=ComplianceItem.Status.NON_COMPLIANT).count(),
        "by_status": [
            {"status": status, "count": visible.filter(status=status).count()}
            for status in ComplianceItem.Status.values
        ],
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over item text fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_items(user).filter(
        Q(title_ar__icontains=query)
        | Q(title_en__icontains=query)
        | Q(standard__icontains=query)
        | Q(finding__icontains=query)
    )[:limit]
    return [
        {
            "id": item.id,
            "kind": "compliance",
            "label_ar": item.title_ar,
            "label_en": item.title_en,
            "detail": f"{item.standard} · {item.status}",
        }
        for item in matches
    ]


def serialize_detail(item: ComplianceItem) -> dict[str, Any]:
    """Full compliance payload (only called after the clearance check passes)."""
    return {
        "id": item.id,
        "title_ar": item.title_ar,
        "title_en": item.title_en,
        "standard": item.standard,
        "status": item.status,
        "finding": item.finding,
        "classification": item.classification,
        "updated_at": item.updated_at.isoformat(),
    }
