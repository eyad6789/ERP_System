"""Applicant use-cases. Clearance filtering happens HERE (server-side), never in
the UI — applicants above the viewer's clearance are excluded from every query
(FILTER pattern, mirroring personnel).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import Applicant


def visible_applicants(user: Any) -> QuerySet[Applicant]:
    """Applicant queryset limited to records at or below the user's clearance."""
    return Applicant.objects.filter(classification__lte=user.clearance)


def filter_by_query(applicants: QuerySet[Applicant], query: str) -> QuerySet[Applicant]:
    """Case-insensitive contains filter over the applicant's text fields."""
    return applicants.filter(
        Q(name__icontains=query) | Q(position__icontains=query) | Q(email__icontains=query)
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
            target=f"Applicant:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting applicant counts (over-clearance rows are excluded)."""
    visible = visible_applicants(user)
    return {
        "key": "recruitment",
        "total": visible.count(),
        "by_stage": [
            {"stage": stage, "count": visible.filter(stage=stage).count()}
            for stage in Applicant.Stage.values
        ],
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over applicant text fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_applicants(user).filter(
        Q(name__icontains=query) | Q(position__icontains=query)
    )[:limit]
    return [
        {
            "id": applicant.id,
            "kind": "applicant",
            "label_ar": applicant.name,
            "label_en": applicant.name,
            "detail": f"{applicant.position} · {applicant.stage}",
        }
        for applicant in matches
    ]


def serialize_detail(applicant: Applicant) -> dict[str, Any]:
    """Full applicant payload (only called after the clearance check passes)."""
    return {
        "id": applicant.id,
        "name": applicant.name,
        "position": applicant.position,
        "email": applicant.email,
        "stage": applicant.stage,
        "classification": applicant.classification,
        "updated_at": applicant.updated_at.isoformat(),
    }
