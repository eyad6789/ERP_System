"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `procurement` app.
"""

from .infrastructure.models import PurchaseOrder, Vendor

__all__ = ["PurchaseOrder", "Vendor"]
