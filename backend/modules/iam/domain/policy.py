"""Pure authorization rules. No Django, no I/O — unit-testable in isolation.

Two orthogonal checks, both deny-by-default:
  * role  -> allowed modules        (can_access_module)
  * clearance -> max data sensitivity (can_read_sensitivity)
"""

from __future__ import annotations

from collections.abc import Iterable


def can_access_module(role_modules: Iterable[str], module: str) -> bool:
    """True iff the role's allow-list grants `module`. Empty/unknown -> denied."""
    if not module:
        return False
    return module in set(role_modules)


def can_read_sensitivity(user_clearance: int, object_classification: int) -> bool:
    """True iff the user is cleared to read data at `object_classification`.

    Denies by default on any falsy/invalid clearance.
    """
    try:
        return int(user_clearance) >= int(object_classification)
    except (TypeError, ValueError):
        return False
