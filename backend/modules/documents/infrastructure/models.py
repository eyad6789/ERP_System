"""Documents ORM models: Document (classified, versioned, owned) + DocumentVersion.

A document above the viewer's clearance is never returned in full: its title and
body are withheld server-side. Every full read is audited and counted.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Document(models.Model):
    title_ar = models.CharField(max_length=200)
    title_en = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.PROTECT,
        related_name="owned_documents",
    )
    version = models.PositiveIntegerField(default=1)
    access_count = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "documents_document"
        ordering = ["-classification", "-updated_at"]

    def __str__(self) -> str:
        return self.title_en


class DocumentVersion(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="versions")
    number = models.PositiveIntegerField()
    note_ar = models.CharField(max_length=200, blank=True)
    note_en = models.CharField(max_length=200, blank=True)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "documents_version"
        ordering = ["-number"]
        unique_together = ("document", "number")

    def __str__(self) -> str:
        return f"{self.document_id} v{self.number}"
