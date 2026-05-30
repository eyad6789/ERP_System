"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `contracts` app.
"""

from .infrastructure.models import ContractRecord

__all__ = ["ContractRecord"]
