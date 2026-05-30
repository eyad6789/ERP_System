"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `attendance` app.
"""

from .infrastructure.models import AttendanceRecord

__all__ = ["AttendanceRecord"]
