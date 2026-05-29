"""Public interface of the inventory module. Other modules import from here only."""

from __future__ import annotations

from .services import (
    create_item,
    delete_item,
    module_summary,
    search,
    serialize_detail,
    update_item,
    visible_items,
)

__all__ = [
    "create_item",
    "delete_item",
    "module_summary",
    "search",
    "serialize_detail",
    "update_item",
    "visible_items",
]
