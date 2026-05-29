"""Document use-cases. Over-clearance documents are listed but REDACTED: their
title and body are withheld server-side (never serialized), so the redaction
cannot be undone in the browser.
"""

from __future__ import annotations

from typing import Any

from django.db.models import F, Q, QuerySet

from modules.iam.application import public as iam

from ..infrastructure.models import Document, DocumentVersion

ORDERING_WHITELIST: frozenset[str] = frozenset(
    {"title_en", "classification", "updated_at", "version"}
)


def _ordered_queryset(query: str, ordering: str) -> QuerySet[Document]:
    """Build the list queryset honouring optional search + whitelisted ordering."""
    qs = Document.objects.select_related("owner").all()
    query = query.strip()
    if query:
        qs = qs.filter(Q(title_ar__icontains=query) | Q(title_en__icontains=query))
    field = ordering.lstrip("-")
    if field in ORDERING_WHITELIST:
        qs = qs.order_by(ordering)
    return qs


def list_documents(user: Any, query: str = "", ordering: str = "") -> list[dict[str, Any]]:
    """All documents, with title withheld for records above the user's clearance.

    Optional `query` filters (icontains) over titles; optional `ordering` sorts
    by a whitelisted field ('-' prefix = descending). Unknown fields are ignored.
    """
    items: list[dict[str, Any]] = []
    for doc in _ordered_queryset(query, ordering):
        visible = iam.can_read_sensitivity(user.clearance, doc.classification)
        items.append(
            {
                "id": doc.id,
                "classification": doc.classification,
                "locked": not visible,
                "version": doc.version,
                "access_count": doc.access_count,
                "owner": doc.owner.username if doc.owner else None,
                "updated_at": doc.updated_at.isoformat(),
                # Title is withheld server-side when the user is not cleared.
                "title_ar": doc.title_ar if visible else None,
                "title_en": doc.title_en if visible else None,
            }
        )
    return items


def module_summary(user: Any) -> dict[str, Any]:
    """Clearance-respecting document counts (locked rows are counted, never read)."""
    total = 0
    accessible = 0
    by_level: dict[int, int] = dict.fromkeys(range(1, 5), 0)
    for classification in Document.objects.values_list("classification", flat=True):
        total += 1
        by_level[classification] = by_level.get(classification, 0) + 1
        if iam.can_read_sensitivity(user.clearance, classification):
            accessible += 1
    return {
        "key": "documents",
        "total": total,
        "accessible": accessible,
        "locked": total - accessible,
        "by_classification": [{"level": level, "count": by_level[level]} for level in range(1, 5)],
    }


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    """Case-insensitive title search over documents the user is cleared to see."""
    query = query.strip()
    if not query:
        return []
    results: list[dict[str, Any]] = []
    matches = Document.objects.filter(title_ar__icontains=query) | Document.objects.filter(
        title_en__icontains=query
    )
    for doc in matches.distinct():
        if not iam.can_read_sensitivity(user.clearance, doc.classification):
            continue
        results.append(
            {
                "id": doc.id,
                "kind": "document",
                "label_ar": doc.title_ar,
                "label_en": doc.title_en,
                "detail": f"v{doc.version} · classification {doc.classification}",
            }
        )
        if len(results) >= limit:
            break
    return results


def record_full_read(document: Document) -> Document:
    """Count an authorized full read (atomic increment)."""
    Document.objects.filter(pk=document.pk).update(access_count=F("access_count") + 1)
    document.refresh_from_db(fields=["access_count"])
    return document


def serialize_detail(document: Document) -> dict[str, Any]:
    """Full document payload (only called after the clearance check passes)."""
    return {
        "id": document.id,
        "title_ar": document.title_ar,
        "title_en": document.title_en,
        "body": document.body,
        "classification": document.classification,
        "version": document.version,
        "access_count": document.access_count,
        "owner": document.owner.username if document.owner else None,
        "updated_at": document.updated_at.isoformat(),
        "versions": [
            {
                "number": v.number,
                "note_ar": v.note_ar,
                "note_en": v.note_en,
                "created_at": v.created_at.isoformat(),
            }
            for v in document.versions.all()
        ],
    }


def create_document(user: Any, data: dict[str, Any]) -> Document:
    """Persist a new document (owned by `user`) and its initial version (number=1)."""
    document = Document.objects.create(
        title_ar=data["title_ar"],
        title_en=data["title_en"],
        body=data.get("body", ""),
        classification=data["classification"],
        owner=user if getattr(user, "is_authenticated", False) else None,
        version=1,
    )
    DocumentVersion.objects.create(
        document=document,
        number=1,
        author=user if getattr(user, "is_authenticated", False) else None,
    )
    return document


def update_document(document: Document, data: dict[str, Any]) -> Document:
    """Apply a partial update to a document (only supplied fields are written)."""
    for field in ("title_ar", "title_en", "body", "classification"):
        if field in data:
            setattr(document, field, data[field])
    document.save()
    return document


def add_version(user: Any, document: Document) -> Document:
    """Bump the document version by one and snapshot a DocumentVersion from its body."""
    document.version = F("version") + 1
    document.save(update_fields=["version"])
    document.refresh_from_db(fields=["version"])
    DocumentVersion.objects.create(
        document=document,
        number=document.version,
        note_ar=document.body[:200],
        note_en=document.body[:200],
        author=user if getattr(user, "is_authenticated", False) else None,
    )
    return document
