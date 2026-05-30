"""Public interface of the workspaces module. Other modules import from here only."""

from __future__ import annotations

from .services import (
    EDITABLE_FIELDS,
    apply_update,
    can_edit_workspace,
    list_workspaces,
    serialize,
)

__all__ = [
    "EDITABLE_FIELDS",
    "apply_update",
    "can_edit_workspace",
    "list_workspaces",
    "serialize",
]
