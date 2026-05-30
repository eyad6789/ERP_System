"""Public interface of the attachments module."""

from __future__ import annotations

from .services import (
    create_attachment,
    detect_kind,
    module_summary,
    parse_csv,
    search,
    serialize,
    visible_attachments,
)

__all__ = [
    "create_attachment",
    "detect_kind",
    "module_summary",
    "parse_csv",
    "search",
    "serialize",
    "visible_attachments",
]
