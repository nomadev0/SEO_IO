from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status

from .config import settings


def get_token(authorization: str | None = Header(default=None)) -> str:
    """Extract bearer token from Authorization header."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header",
        )
    return authorization.split(" ", 1)[1].strip()


def dev_auth(token: str = Depends(get_token)) -> None:
    """Validate requests against the development token stub."""
    if token != settings.auth_dev_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

