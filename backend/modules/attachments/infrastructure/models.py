"""Attachment ORM model: a classified uploaded file (document, spreadsheet, image,
or scanned invoice) with optional extracted/parsed data.

A file above the viewer's clearance is never listed or downloadable (FILTER +
object-level checks): enforcement is server-side, never merely hidden in the UI.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Attachment(models.Model):
    class Kind(models.TextChoices):
        DOCUMENT = "document", "Document"
        SPREADSHEET = "spreadsheet", "Spreadsheet"
        IMAGE = "image", "Image"
        INVOICE = "invoice", "Invoice"
        OTHER = "other", "Other"

    original_name = models.CharField(max_length=255)
    file = models.FileField(upload_to="attachments/%Y/%m/")
    content_type = models.CharField(max_length=120, blank=True)
    size = models.PositiveIntegerField(default=0)
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.OTHER)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.PROTECT, related_name="attachments"
    )
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    # Parsed/extracted structured data (CSV/XLSX rows, OCR'd invoice fields, ...).
    extracted = models.JSONField(default=dict, blank=True)
    # Optional link to another module's record (e.g. an invoice attached to a contract).
    linked_module = models.CharField(max_length=32, blank=True)
    linked_id = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "attachments_attachment"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.original_name
