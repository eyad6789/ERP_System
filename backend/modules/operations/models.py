"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `operations` app.
"""

from .infrastructure.models import Task

__all__ = ["Task"]
