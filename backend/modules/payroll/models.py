"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `payroll` app.
"""

from .infrastructure.models import Payslip

__all__ = ["Payslip"]
