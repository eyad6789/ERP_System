"""Django discovers models via `<app>.models`; the definition lives in infrastructure."""

from .infrastructure.models import Attachment

__all__ = ["Attachment"]
