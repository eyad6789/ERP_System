"""Safe DRF exception handler: never leak stack traces or internal IDs.

Maps known DRF exceptions to generic, stable messages. Anything unexpected
becomes a flat 500 with no detail (the traceback still goes to server logs).
"""

from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_default_handler

_SAFE_MESSAGES = {
    status.HTTP_400_BAD_REQUEST: "Invalid request.",
    status.HTTP_401_UNAUTHORIZED: "Authentication required.",
    status.HTTP_403_FORBIDDEN: "You do not have permission to perform this action.",
    status.HTTP_404_NOT_FOUND: "Not found.",
    status.HTTP_405_METHOD_NOT_ALLOWED: "Method not allowed.",
    status.HTTP_429_TOO_MANY_REQUESTS: "Too many requests.",
}


def safe_exception_handler(exc: Exception, context: dict) -> Response | None:
    response = drf_default_handler(exc, context)
    if response is None:
        # Unhandled error: do not echo anything internal.
        return Response(
            {"detail": "A server error occurred."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Validation errors (400) keep their field map; everything else is flattened
    # to a safe, generic message so no internal identifiers leak.
    if response.status_code != status.HTTP_400_BAD_REQUEST:
        response.data = {"detail": _SAFE_MESSAGES.get(response.status_code, "Request failed.")}
    return response
