"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `performance` app.
"""

from .infrastructure.models import PerformanceReview

__all__ = ["PerformanceReview"]
