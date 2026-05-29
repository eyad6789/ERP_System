"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `risk` app.
"""

from .infrastructure.models import Risk

__all__ = ["Risk"]
