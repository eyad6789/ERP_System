"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `fleet` app.
"""

from .infrastructure.models import MaintenanceRecord, Vehicle

__all__ = ["MaintenanceRecord", "Vehicle"]
