"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `events` app.
"""

from .infrastructure.models import Event

__all__ = ["Event"]
