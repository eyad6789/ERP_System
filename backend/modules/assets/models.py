"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `assets` app.
"""

from .infrastructure.models import Asset

__all__ = ["Asset"]
