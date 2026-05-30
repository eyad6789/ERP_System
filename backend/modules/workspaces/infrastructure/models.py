"""Department Workspace ORM model.

A Workspace is one of the 8 department categories the sidebar groups pages into.
Each is OWNED by a department; only a member of that department (or a sysadmin)
may EDIT it. Ownership is enforced in the application/interface layers — the model
itself just stores the editable bilingual presentation fields.
"""

from __future__ import annotations

from django.db import models


class Workspace(models.Model):
    key = models.CharField(max_length=32, unique=True, db_index=True)
    name_ar = models.CharField(max_length=128)
    name_en = models.CharField(max_length=128)
    description_ar = models.TextField(blank=True)
    description_en = models.TextField(blank=True)
    mission_ar = models.CharField(max_length=255, blank=True)
    mission_en = models.CharField(max_length=255, blank=True)
    accent_color = models.CharField(max_length=16, default="#c9a227")
    owner_department = models.CharField(max_length=64)
    head_name = models.CharField(max_length=128, blank=True)
    featured = models.JSONField(default=list, blank=True)
    updated_by = models.CharField(max_length=150, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workspaces_workspace"
        ordering = ["key"]

    def __str__(self) -> str:
        return self.key
