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
