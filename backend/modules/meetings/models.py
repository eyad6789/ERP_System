"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `meetings` app.
"""

from .infrastructure.models import Meeting

__all__ = ["Meeting"]
