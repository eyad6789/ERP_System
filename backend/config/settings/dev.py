"""Development settings: convenient, not hardened."""

from __future__ import annotations

from .base import *  # noqa: F403
from .base import env

DEBUG = True
ALLOWED_HOSTS = ["*"]

# Permit the Vite dev server origin for cross-origin XHR during local dev.
CORS_ALLOWED_ORIGINS = env.list(
    "DJANGO_CORS_ALLOWED_ORIGINS",
    default=["http://localhost:5173", "http://127.0.0.1:5173"],
)
CORS_ALLOW_CREDENTIALS = True

# Trust the local SPA origins (served same-origin via nginx, or via the Vite proxy).
CSRF_TRUSTED_ORIGINS = env.list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    default=[
        "http://localhost",
        "http://localhost:80",
        "http://localhost:8080",
        "http://localhost:5173",
        "http://127.0.0.1",
    ],
)
