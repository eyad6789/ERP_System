"""GIS use-cases. Clearance filtering happens HERE (server-side), never in the
UI — sites above the viewer's clearance are excluded from every query (the
personnel FILTER pattern), so an uncleared caller never learns they exist.
"""

from __future__ import annotations

from typing import Any

from django.db.models import QuerySet

from ..infrastructure.models import Site


def visible_sites(user: Any) -> QuerySet[Site]:
    """Map queryset limited to sites at or below the user's clearance."""
    return Site.objects.filter(classification__lte=user.clearance)


def serialize_site(site: Site) -> dict[str, Any]:
    """Public site payload (coordinates + bilingual labels)."""
    return {
        "id": site.id,
        "name_ar": site.name_ar,
        "name_en": site.name_en,
        "site_type": site.site_type,
        "lat": site.lat,
        "lng": site.lng,
        "info_ar": site.info_ar,
        "info_en": site.info_en,
        "classification": site.classification,
    }
