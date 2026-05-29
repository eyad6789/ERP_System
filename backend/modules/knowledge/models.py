"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `knowledge` app.
"""

from .infrastructure.models import Article

__all__ = ["Article"]
