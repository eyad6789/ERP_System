"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `compliance` app.
"""

from .infrastructure.models import ComplianceItem

__all__ = ["ComplianceItem"]
