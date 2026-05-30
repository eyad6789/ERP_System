"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `announcements` app.
"""

from .infrastructure.models import Announcement

__all__ = ["Announcement"]
