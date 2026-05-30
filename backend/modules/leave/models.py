"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `leave` app.
"""

from .infrastructure.models import LeaveRequest

__all__ = ["LeaveRequest"]
