from __future__ import annotations

from fastapi import HTTPException, status


class AppError(HTTPException):
    """Base application error to map domain failures to HTTP responses."""

    def __init__(self, detail: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(status_code=status_code, detail=detail)

