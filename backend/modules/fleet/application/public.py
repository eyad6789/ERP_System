"""Public interface of the fleet module. Other modules import from here only."""

from __future__ import annotations

from .services import (
    create_vehicle,
    delete_vehicle,
    module_summary,
    search,
    serialize_detail,
    update_vehicle,
    visible_vehicles,
)

__all__ = [
    "create_vehicle",
    "delete_vehicle",
    "module_summary",
    "search",
    "serialize_detail",
    "update_vehicle",
    "visible_vehicles",
]
