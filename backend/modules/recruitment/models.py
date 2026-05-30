"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `recruitment` app.
"""

from .infrastructure.models import Applicant

__all__ = ["Applicant"]
