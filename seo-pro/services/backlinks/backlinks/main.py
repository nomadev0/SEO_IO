from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from structlog import get_logger

from backlinks.api.routers import alerts, backlinks, domains, exports, health
from backlinks.core.config import settings
from backlinks.core.errors import AppError
from backlinks.core.logging import configure_logging

logger = get_logger()

configure_logging(settings.log_level)

app = FastAPI(
    title="SEO Pro Backlinks API",
    version="0.1.0",
    description="Backlinks management API powering the SEO dashboard.",
)

app.include_router(health.router)
app.include_router(domains.router)
app.include_router(backlinks.router)
app.include_router(alerts.router)
app.include_router(exports.router)


@app.exception_handler(AppError)
async def handle_app_error(_: Request, exc: AppError):
    logger.warning("app.error", detail=exc.detail, status_code=exc.status_code)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info("request.start", method=request.method, path=request.url.path)
    response = await call_next(request)
    logger.info("request.end", method=request.method, path=request.url.path, status=response.status_code)
    return response

