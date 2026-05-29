"""Asset use-cases. Clearance filtering happens HERE (server-side), never in the
UI — assets above the viewer's clearance are excluded from every query (FILTER
pattern, mirroring personnel).
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request

from ..infrastructure.models import Asset


def visible_assets(user: Any) -> QuerySet[Asset]:
    """Asset queryset limited to records at or below the user's clearance."""
    return Asset.objects.filter(classification__lte=user.clearance)


def filter_by_query(assets: QuerySet[Asset], query: str) -> QuerySet[Asset]:
    """Case-insensitive contains filter over the asset's text fields."""
    return assets.filter(
        Q(name_ar__icontains=query)
        | Q(name_en__icontains=query)
        | Q(asset_type__icontains=query)
        | Q(location__icontains=query)
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
            target=f"Asset:classification={classification}",
            result="DENIED",
        )
        raise PermissionDenied()


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting asset counts (over-clearance rows are excluded)."""
    visible = visible_assets(user)
    return {
        "key": "assets",
        "total": visible.count(),
        "by_condition": [
            {"condition": condition, "count": visible.filter(condition=condition).count()}
            for condition in Asset.Condition.values
        ],
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over asset text fields, limited to visible rows."""
    query = query.strip()
    if not query:
        return []
    matches = visible_assets(user).filter(
        Q(name_ar__icontains=query)
        | Q(name_en__icontains=query)
        | Q(asset_type__icontains=query)
        | Q(location__icontains=query)
    )[:limit]
    return [
        {
            "id": asset.id,
            "kind": "asset",
            "label_ar": asset.name_ar,
            "label_en": asset.name_en,
            "detail": f"{asset.asset_type} · {asset.location} · {asset.condition}",
        }
        for asset in matches
    ]


def serialize_detail(asset: Asset) -> dict[str, Any]:
    """Full asset payload (only called after the clearance check passes)."""
    return {
        "id": asset.id,
        "name_ar": asset.name_ar,
        "name_en": asset.name_en,
        "asset_type": asset.asset_type,
        "location": asset.location,
        "condition": asset.condition,
        "classification": asset.classification,
        "updated_at": asset.updated_at.isoformat(),
    }
