"""Document use-cases. Over-clearance documents are listed but REDACTED: their
title and body are withheld server-side (never serialized), so the redaction
cannot be undone in the browser.
"""

from __future__ import annotations

from typing import Any

from django.db.models import F

from modules.iam.application import public as iam

from ..infrastructure.models import Document


def list_documents(user: Any) -> list[dict[str, Any]]:
    """All documents, with title withheld for records above the user's clearance."""
    items: list[dict[str, Any]] = []
    for doc in Document.objects.select_related("owner").all():
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
