"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `workspaces` app.
"""

from .infrastructure.models import Workspace

__all__ = ["Workspace"]
