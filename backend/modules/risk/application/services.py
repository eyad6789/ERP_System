"""Risk use-cases. Clearance filtering happens HERE (server-side), never in the
UI — risks above the viewer's clearance are excluded from every query (FILTER
pattern, mirroring assets/personnel).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import Risk

HIGH_SCORE_THRESHOLD = 15


def visible_risks(user: Any) -> QuerySet[Risk]:
    """Risk queryset limited to records at or below the user's clearance."""
    return Risk.objects.filter(classification__lte=user.clearance)


def filter_by_query(risks: QuerySet[Risk], query: str) -> QuerySet[Risk]:
    """Case-insensitive contains filter over the risk's title fields."""
    return risks.filter(Q(title_ar__icontains=query) | Q(title_en__icontains=query))


def enforce_classification_ceiling(request: Request, classification: int, *, action: str) -> None:
    """Reject (403 + DENIED audit) an attempt to create/set a classification ABOVE
    the caller's own clearance. Mirrors enforce_object_clearance for write paths."""
    from modules.iam.application import public as iam

    user_clearance = getattr(request.user, "clearance", 0)
    if not iam.can_read_sensitivity(user_clearance, classification):
        iam.record_audit(
            request,
            action=action,
            target=f"Risk:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def serialize_detail(risk: Risk) -> dict[str, Any]:
    """Full risk payload (only called after the clearance check passes)."""
    return {
        "id": risk.id,
        "title_ar": risk.title_ar,
        "title_en": risk.title_en,
        "likelihood": risk.likelihood,
        "impact": risk.impact,
        "score": risk.score,
        "status": risk.status,
        "mitigation": risk.mitigation,
        "classification": risk.classification,
        "updated_at": risk.updated_at.isoformat(),
    }


def create_risk(data: dict[str, Any]) -> Risk:
    """Persist a new risk (clearance guard lives in the view)."""
    return Risk.objects.create(**data)


def update_risk(risk: Risk, data: dict[str, Any]) -> Risk:
    """Apply a partial update to ``risk`` (clearance guard lives in the view)."""
    for field, value in data.items():
        setattr(risk, field, value)
    risk.save()
    return risk


def delete_risk(risk: Risk) -> None:
    """Remove a risk (clearance guard lives in the view)."""
    risk.delete()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting risk counts (over-clearance rows are excluded)."""
    visible = visible_risks(user)
    return {
        "key": "risk",
        "total": visible.count(),
        "open": visible.filter(status=Risk.Status.OPEN).count(),
        "high": visible.filter(score__gte=HIGH_SCORE_THRESHOLD).count(),
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over risk title fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_risks(user).filter(
        Q(title_ar__icontains=query) | Q(title_en__icontains=query)
    )[:limit]
    return [
        {
            "id": risk.id,
            "kind": "risk",
            "label_ar": risk.title_ar,
            "label_en": risk.title_en,
            "detail": f"{risk.get_status_display()} · score {risk.score}",
        }
        for risk in matches
    ]
