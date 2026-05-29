"""GIS use-cases. Clearance filtering happens HERE (server-side), never in the
UI — sites above the viewer's clearance are excluded from every query (the
personnel FILTER pattern), so an uncleared caller never learns they exist.
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q, QuerySet

from ..infrastructure.models import Site

_ORDERING_WHITELIST = frozenset({"name_en", "site_type", "classification"})


def visible_sites(user: Any) -> QuerySet[Site]:
    """Map queryset limited to sites at or below the user's clearance."""
    return Site.objects.filter(classification__lte=user.clearance)


def list_sites(user: Any, *, q: str = "", ordering: str = "") -> QuerySet[Site]:
    """Clearance-filtered site list with optional text search and ordering.

    `q` is matched case-insensitively across the bilingual name/info fields.
    `ordering` accepts a whitelisted field (name_en, site_type, classification)
    optionally prefixed with '-' for descending; unknown fields are ignored so
    the default model ordering applies.
    """
    sites = visible_sites(user)
    q = q.strip()
    if q:
        sites = sites.filter(
            Q(name_ar__icontains=q)
            | Q(name_en__icontains=q)
            | Q(info_ar__icontains=q)
            | Q(info_en__icontains=q)
        )
    field = ordering.lstrip("-")
    if field in _ORDERING_WHITELIST:
        sites = sites.order_by(ordering)
    return sites


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


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting counts of visible sites, broken down by site type."""
    visible = visible_sites(user)
    return {
        "key": "gis",
        "total": visible.count(),
        "by_type": [
            {
                "type": site_type,
                "count": visible.filter(site_type=site_type).count(),
            }
            for site_type in Site.SiteType.values
        ],
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over site text fields, clearance-respecting."""
    query = query.strip()
    if not query:
        return []
    results: list[dict[str, Any]] = []
    matches = visible_sites(user).filter(
        Q(name_ar__icontains=query)
        | Q(name_en__icontains=query)
        | Q(info_ar__icontains=query)
        | Q(info_en__icontains=query)
    )[:limit]
    for site in matches:
        results.append(
            {
                "id": site.id,
                "kind": "site",
                "label_ar": site.name_ar,
                "label_en": site.name_en,
                "detail": site.get_site_type_display(),
            }
        )
    return results
