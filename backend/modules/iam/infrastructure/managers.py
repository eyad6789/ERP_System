from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib.auth.base_user import BaseUserManager
from django.db import models

if TYPE_CHECKING:
    from .models import User


class UserManager(BaseUserManager["User"]):
    """Manager for the custom User model (username-based)."""

    use_in_migrations = True

    def _create_user(self, username: str, password: str | None, **extra: Any) -> User:
        if not username:
            raise ValueError("Username is required.")
        user = self.model(username=username, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, username: str, password: str | None = None, **extra: Any) -> User:
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(username, password, **extra)

    def create_superuser(self, username: str, password: str | None = None, **extra: Any) -> User:
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("clearance", 4)
        if extra.get("is_staff") is not True or extra.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_staff=True and is_superuser=True.")
        return self._create_user(username, password, **extra)


class AppendOnlyManager(models.Manager):
    """Manager that refuses bulk update/delete on append-only tables.

    This is one of three append-only layers (model.save guard + DB trigger are
    the others). It blocks the common ORM mutation paths.
    """

    def update(self, *args: Any, **kwargs: Any):  # noqa: ANN201
        raise NotImplementedError("AuditEvent is append-only; update() is forbidden.")

    def delete(self, *args: Any, **kwargs: Any):  # noqa: ANN201
        raise NotImplementedError("AuditEvent is append-only; delete() is forbidden.")
