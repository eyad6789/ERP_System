"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `inventory` app.
"""

from .infrastructure.models import InventoryItem, Warehouse

__all__ = ["InventoryItem", "Warehouse"]
