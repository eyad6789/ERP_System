"""Public interface of the documents module. Other modules import from here only."""

from __future__ import annotations

from .services import (
    add_version,
    create_document,
    list_documents,
    module_summary,
    record_full_read,
    search,
    serialize_detail,
    update_document,
)

__all__ = [
    "add_version",
    "create_document",
    "list_documents",
    "module_summary",
    "record_full_read",
    "search",
    "serialize_detail",
    "update_document",
]
