"""Public interface of the projects module. Other modules import from here only."""

from __future__ import annotations

from .services import (
    create_project,
    delete_project,
    module_summary,
    search,
    serialize_detail,
    update_project,
    visible_projects,
)

__all__ = [
    "create_project",
    "delete_project",
    "module_summary",
    "search",
    "serialize_detail",
    "update_project",
    "visible_projects",
]
