"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `gis` app.
"""

from .infrastructure.models import Site

__all__ = ["Site"]
