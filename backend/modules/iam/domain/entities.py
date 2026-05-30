"""Pure domain entities for IAM. No Django imports allowed here."""

from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum


class ClearanceLevel(IntEnum):
    """Data sensitivity / personnel clearance. Mirrors the prototype CLR map."""

    PUBLIC = 1
    RESTRICTED = 2
    SECRET = 3
    TOP_SECRET = 4


# All modules a role may be granted access to (mirrors the prototype ROLES.modules).
KNOWN_MODULES: tuple[str, ...] = (
    "dashboard",
    "personnel",
    "documents",
    "finance",
    "operations",
    "assets",
    "gis",
    "incidents",
    "audit",
    "projects",
    "procurement",
    "inventory",
    "fleet",
    "risk",
    "knowledge",
    "attendance",
    "leave",
    "payroll",
    "helpdesk",
    "compliance",
    "meetings",
    "recruitment",
    "performance",
    "training",
    "contracts",
    "announcements",
    "events",
)


@dataclass(frozen=True)
class RoleSpec:
    """An immutable description of a role used by the domain policy."""

    code: str
    modules: tuple[str, ...]
    clearance: ClearanceLevel
