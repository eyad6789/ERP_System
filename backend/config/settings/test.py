"""Test settings: fast and hermetic."""

from __future__ import annotations

from .base import *  # noqa: F403

DEBUG = False

# Fast password hashing in tests.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Local-memory cache + DB-backed sessions so tests need no Redis.
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
SESSION_ENGINE = "django.contrib.sessions.backends.db"

CELERY_TASK_ALWAYS_EAGER = True
