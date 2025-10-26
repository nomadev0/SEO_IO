from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/healthz", summary="Service healthcheck")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}

