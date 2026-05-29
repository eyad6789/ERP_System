"""Asset use-cases. Clearance filtering happens HERE (server-side), never in the
UI — assets above the viewer's clearance are excluded from every query (FILTER
pattern, mirroring personnel).
"""

from __future__ import annotations

from typing import Any

from django.db.models import QuerySet

from ..infrastructure.models import Asset


def visible_assets(user: Any) -> QuerySet[Asset]:
    """Asset queryset limited to records at or below the user's clearance."""
    return Asset.objects.filter(classification__lte=user.clearance)


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
