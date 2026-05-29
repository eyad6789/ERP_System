"""Public interface of the knowledge module. Other modules import from here only."""

from __future__ import annotations

from .services import (
    create_article,
    delete_article,
    module_summary,
    search,
    serialize_detail,
    update_article,
    visible_articles,
)

__all__ = [
    "create_article",
    "delete_article",
    "module_summary",
    "search",
    "serialize_detail",
    "update_article",
    "visible_articles",
]
