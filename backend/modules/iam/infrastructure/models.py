"""IAM ORM models: Role, User, and the append-only AuditEvent."""

from __future__ import annotations

from typing import Any

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models

from ..domain.entities import ClearanceLevel
from .managers import AppendOnlyManager, UserManager

CLEARANCE_CHOICES = [(level.value, level.name.title()) for level in ClearanceLevel]


class Role(models.Model):
    """A role: an allow-list of modules plus a clearance ceiling."""

    code = models.CharField(max_length=32, unique=True)
    name_ar = models.CharField(max_length=128)
    name_en = models.CharField(max_length=128)
    modules = models.JSONField(default=list)
    clearance = models.IntegerField(choices=CLEARANCE_CHOICES, default=ClearanceLevel.PUBLIC)

    class Meta:
        db_table = "iam_role"

    def __str__(self) -> str:
        return self.code


class User(AbstractBaseUser, PermissionsMixin):
    """Custom user carrying role + effective clearance + department."""

    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(blank=True)
    full_name_ar = models.CharField(max_length=128, blank=True)
    full_name_en = models.CharField(max_length=128, blank=True)
    role = models.ForeignKey(Role, null=True, on_delete=models.PROTECT, related_name="users")
    clearance = models.IntegerField(choices=CLEARANCE_CHOICES, default=ClearanceLevel.PUBLIC)
    department = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)  # type: ignore[misc]
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []

    class Meta:
        db_table = "iam_user"

    def __str__(self) -> str:
        return self.username

    @property
    def allowed_modules(self) -> list[str]:
        """Modules granted by this user's role (empty if no role)."""
        return list(self.role.modules) if self.role else []


class AuditEvent(models.Model):
    """Append-only record of every access decision and state change.

    Tamper-evidence is enforced at three layers: this model's save() guard,
    the AppendOnlyManager, and a Postgres BEFORE UPDATE/DELETE trigger
    (migration 0002).
    """

    class Result(models.TextChoices):
        GRANTED = "GRANTED", "Granted"
        DENIED = "DENIED", "Denied"

    ts = models.DateTimeField(auto_now_add=True, db_index=True)
    actor = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.PROTECT, related_name="audit_events"
    )
    actor_label = models.CharField(max_length=150, blank=True)
    action = models.CharField(max_length=64)
    target_type = models.CharField(max_length=64, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    result = models.CharField(max_length=8, choices=Result.choices)
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=256, blank=True)
    request_id = models.CharField(max_length=64, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    objects = AppendOnlyManager()

    class Meta:
        db_table = "iam_audit_event"
        ordering = ["-ts"]

    def __str__(self) -> str:
        return f"[{self.ts:%Y-%m-%d %H:%M:%S}] {self.actor_label} {self.action} -> {self.result}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.pk is not None:
            raise ValueError("AuditEvent rows are append-only and cannot be modified.")
        super().save(*args, **kwargs)

    def delete(self, *args: Any, **kwargs: Any):  # noqa: ANN201
        raise ValueError("AuditEvent rows are append-only and cannot be deleted.")
