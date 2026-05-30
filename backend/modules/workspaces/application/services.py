"""Department Workspace use-cases.

Authorization is OWNERSHIP-based (department), not clearance-based: a workspace is
owned by exactly one department and only a member of that department (or a sysadmin)
may edit it. `can_edit` is computed HERE server-side and re-checked on every PATCH —
the client value is never trusted.
"""

from __future__ import annotations

from typing import Any

from django.db.models import QuerySet

from ..infrastructure.models import Workspace

# The 9 fields a PATCH may set. `key` and `owner_department` are immutable.
EDITABLE_FIELDS = frozenset(
    {
        "name_ar",
        "name_en",
        "description_ar",
        "description_en",
        "mission_ar",
        "mission_en",
        "accent_color",
        "head_name",
        "featured",
    }
)


def can_edit_workspace(user: Any, ws: Workspace) -> bool:
    """True iff ``user`` may edit ``ws``: a sysadmin (role code or superuser) or a
    member of the owning department."""
    if getattr(user, "is_superuser", False):
        return True
    role = getattr(user, "role", None)
    if role and role.code == "sysadmin":
        return True
    department = getattr(user, "department", "")
    return bool(department) and department == ws.owner_department


def serialize(ws: Workspace, user: Any) -> dict[str, Any]:
    """Snake_case workspace payload with a SERVER-computed ``can_edit`` for ``user``."""
    return {
        "key": ws.key,
        "name_ar": ws.name_ar,
        "name_en": ws.name_en,
        "description_ar": ws.description_ar,
        "description_en": ws.description_en,
        "mission_ar": ws.mission_ar,
        "mission_en": ws.mission_en,
        "accent_color": ws.accent_color,
        "owner_department": ws.owner_department,
        "head_name": ws.head_name,
        "featured": ws.featured,
        "can_edit": can_edit_workspace(user, ws),
        "updated_at": ws.updated_at.isoformat(),
        "updated_by": ws.updated_by or None,
    }


def list_workspaces() -> QuerySet[Workspace]:
    """All workspaces, ordered by key."""
    return Workspace.objects.all().order_by("key")


def apply_update(ws: Workspace, data: dict[str, Any], username: str) -> Workspace:
    """Assign only the EDITABLE_FIELDS present in ``data``, stamp ``updated_by`` and
    save. The ownership guard lives in the view."""
    for field in EDITABLE_FIELDS:
        if field in data:
            setattr(ws, field, data[field])
    ws.updated_by = username
    ws.save()
    return ws
