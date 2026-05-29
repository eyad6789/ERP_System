"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `documents` app.
"""

from .infrastructure.models import Document, DocumentVersion

__all__ = ["Document", "DocumentVersion"]
