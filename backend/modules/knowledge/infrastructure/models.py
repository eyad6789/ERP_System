"""Knowledge ORM models: Article (classified knowledge-base entry by category).

An article above the viewer's clearance is never returned by the listing query
(FILTER pattern): the row is excluded server-side, never merely hidden in the UI.
"""

from __future__ import annotations

from django.db import models

from modules.iam.domain.entities import ClearanceLevel

CLASSIFICATION_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Article(models.Model):
    title_ar = models.CharField(max_length=200)
    title_en = models.CharField(max_length=200)
    body = models.TextField()
    category = models.CharField(max_length=100)
    classification = models.IntegerField(choices=CLASSIFICATION_CHOICES, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "knowledge_article"
        ordering = ["-classification", "title_en"]

    def __str__(self) -> str:
        return self.title_en
