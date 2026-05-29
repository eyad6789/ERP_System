"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `incidents` app.
"""

from .infrastructure.models import Incident

__all__ = ["Incident"]
