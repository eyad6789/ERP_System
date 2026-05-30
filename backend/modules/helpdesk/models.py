"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `helpdesk` app.
"""

from .infrastructure.models import Ticket

__all__ = ["Ticket"]
