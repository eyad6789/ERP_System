"""Public interface of the documents module. Other modules import from here only."""

from __future__ import annotations

from .services import list_documents, module_summary, record_full_read, search, serialize_detail

__all__ = ["list_documents", "module_summary", "record_full_read", "search", "serialize_detail"]
