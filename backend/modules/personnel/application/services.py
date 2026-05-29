"""Personnel use-cases. Clearance filtering happens HERE (server-side), never in
the UI — records above the viewer's clearance are excluded from every query.
"""

from __future__ import annotations

from typing import Any

from django.db.models import Count, Q, QuerySet

from ..infrastructure.models import Department, Person


def visible_personnel(user: Any) -> QuerySet[Person]:
    """Directory queryset limited to records at or below the user's clearance."""
    return Person.objects.filter(classification__lte=user.clearance).select_related("department")


def org_tree(user: Any) -> list[dict[str, Any]]:
    """Departments with a count of members the user is cleared to see.

    The member count uses the same clearance ceiling so it never hints at the
    existence of records above the viewer's clearance.
    """
    departments = Department.objects.annotate(
        visible_members=Count("members", filter=Q(members__classification__lte=user.clearance))
    ).order_by("code")
    return [
        {
            "code": d.code,
            "name_ar": d.name_ar,
            "name_en": d.name_en,
            "parent": d.parent.code if d.parent else None,
            "member_count": d.visible_members,
        }
        for d in departments
    ]


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting counts of visible personnel.

    Every count is drawn from the clearance-limited queryset, so a viewer is
    never told about records above their clearance.
    """
    visible = visible_personnel(user)
    return {
        "key": "personnel",
        "total": visible.count(),
        "active": visible.filter(status=Person.Status.ACTIVE).count(),
        "on_mission": visible.filter(status=Person.Status.MISSION).count(),
        "by_clearance": [
            {"level": level, "count": visible.filter(classification=level).count()}
            for level in range(1, 5)
        ],
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive search over personnel text fields, clearance-respecting."""
    query = query.strip()
    if not query:
        return []
    matches = visible_personnel(user).filter(
        Q(name_ar__icontains=query)
        | Q(name_en__icontains=query)
        | Q(rank_ar__icontains=query)
        | Q(rank_en__icontains=query)
    )[:limit]
    return [
        {
            "id": person.id,
            "kind": "personnel",
            "label_ar": person.name_ar,
            "label_en": person.name_en,
            "detail": person.get_status_display(),
        }
        for person in matches
    ]
