"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `projects` app.
"""

from .infrastructure.models import Milestone, Project

__all__ = ["Milestone", "Project"]
