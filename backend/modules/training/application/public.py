"""Public interface of the training module. Other modules import from here only."""

from __future__ import annotations

from .services import module_summary, search, serialize_detail, visible_courses

__all__ = ["module_summary", "search", "serialize_detail", "visible_courses"]
