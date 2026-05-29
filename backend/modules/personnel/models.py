"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `personnel` app.
"""

from .infrastructure.models import Department, Person

__all__ = ["Department", "Person"]
