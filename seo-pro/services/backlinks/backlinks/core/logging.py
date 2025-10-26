from __future__ import annotations

import logging
import sys

import structlog


def configure_logging(level: str = "INFO") -> None:
    """Configure application-wide structured logging."""

    timestamper = structlog.processors.TimeStamper(fmt="iso")

    structlog.configure(
        processors=[
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            timestamper,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(serializer=None),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(getattr(logging, level, logging.INFO)),
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        level=getattr(logging, level, logging.INFO),
        format="%(message)s",
        stream=sys.stdout,
    )

