"""Attachment use-cases: upload, clearance-filtered listing, CSV parsing, summary.

Clearance filtering happens here (server-side); files above the viewer's clearance
are never listed, downloaded, or parsed.
"""

from __future__ import annotations

import csv
import io
from typing import Any

from django.db.models import Q, QuerySet

from ..infrastructure.models import Attachment

MAX_PREVIEW_ROWS = 200

_SPREADSHEET_EXT = (".csv", ".xlsx", ".xls")
_IMAGE_PREFIX = "image/"


def detect_kind(name: str, content_type: str) -> str:
    lower = name.lower()
    is_spreadsheet = (
        lower.endswith(_SPREADSHEET_EXT)
        or "spreadsheet" in content_type
        or content_type == "text/csv"
    )
    if is_spreadsheet:
        return Attachment.Kind.SPREADSHEET
    if content_type.startswith(_IMAGE_PREFIX):
        return Attachment.Kind.IMAGE
    if lower.endswith((".pdf", ".doc", ".docx", ".txt")):
        return Attachment.Kind.DOCUMENT
    return Attachment.Kind.OTHER


def visible_attachments(user: Any) -> QuerySet[Attachment]:
    return Attachment.objects.filter(classification__lte=user.clearance).select_related("owner")


def create_attachment(
    *,
    user: Any,
    uploaded_file: Any,
    classification: int,
    kind: str = "",
    linked_module: str = "",
    linked_id: str = "",
    extracted: dict[str, Any] | None = None,
) -> Attachment:
    name = uploaded_file.name
    content_type = getattr(uploaded_file, "content_type", "") or ""
    return Attachment.objects.create(
        original_name=name[:255],
        file=uploaded_file,
        content_type=content_type[:120],
        size=getattr(uploaded_file, "size", 0) or 0,
        kind=kind or detect_kind(name, content_type),
        owner=user,
        classification=classification,
        linked_module=linked_module[:32],
        linked_id=linked_id[:64],
        extracted=extracted or {},
    )


def parse_csv(attachment: Attachment) -> dict[str, Any]:
    """Parse a CSV attachment into {columns, rows} (capped), store it, and return it."""
    attachment.file.open("rb")
    try:
        raw = attachment.file.read()
    finally:
        attachment.file.close()
    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        result: dict[str, Any] = {"columns": [], "rows": [], "total_rows": 0}
    else:
        columns = rows[0]
        data = list(rows[1 : 1 + MAX_PREVIEW_ROWS])
        result = {"columns": columns, "rows": data, "total_rows": len(rows) - 1}
    attachment.extracted = result
    attachment.save(update_fields=["extracted"])
    return result


def serialize(attachment: Attachment) -> dict[str, Any]:
    return {
        "id": attachment.id,
        "original_name": attachment.original_name,
        "content_type": attachment.content_type,
        "size": attachment.size,
        "kind": attachment.kind,
        "classification": attachment.classification,
        "owner": attachment.owner.username if attachment.owner else None,
        "linked_module": attachment.linked_module,
        "linked_id": attachment.linked_id,
        "extracted": attachment.extracted,
        "created_at": attachment.created_at.isoformat(),
        "download_url": f"/api/attachments/{attachment.id}/download",
    }


def module_summary(user: Any) -> dict[str, Any]:
    visible = visible_attachments(user)
    by_kind = [
        {"kind": k.value, "count": visible.filter(kind=k.value).count()} for k in Attachment.Kind
    ]
    return {"key": "files", "total": visible.count(), "by_kind": by_kind}


def search(user: Any, query: str, limit: int = 5) -> list[dict[str, Any]]:
    q = (query or "").strip()
    if not q:
        return []
    rows = visible_attachments(user).filter(
        Q(original_name__icontains=q) | Q(linked_module__icontains=q)
    )[:limit]
    return [
        {
            "id": a.id,
            "kind": "attachment",
            "label_ar": a.original_name,
            "label_en": a.original_name,
            "detail": f"{a.kind} · {a.size} bytes",
        }
        for a in rows
    ]
