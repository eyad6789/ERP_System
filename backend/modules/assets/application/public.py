"""Public interface of the assets module. Other modules import from here only."""

from __future__ import annotations

from .services import serialize_detail, visible_assets

__all__ = ["serialize_detail", "visible_assets"]
