"""Django discovers models via `<app>.models`; real definitions live in the
infrastructure layer. Re-export so they are attributed to the `training` app.
"""

from .infrastructure.models import TrainingCourse

__all__ = ["TrainingCourse"]
