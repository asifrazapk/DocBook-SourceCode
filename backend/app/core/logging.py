"""Centralized logging configuration for the backend.

Call configure_logging() once at startup (see main.py). Everywhere else,
just do:

    import logging
    logger = logging.getLogger(__name__)
    logger.info(...)  / logger.warning(...)  / logger.exception(...)

`logger.exception(...)` is the important one -- it logs the full traceback
and should replace bare `except Exception: pass` in places where a failure
is deliberately non-fatal (e.g. best-effort email sending) but shouldn't be
silently invisible either.
"""

import logging
import os
import sys

_CONFIGURED = False


def configure_logging() -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return

    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )

    root = logging.getLogger()
    root.setLevel(level)
    # Avoid duplicate handlers if this ever gets called more than once
    # (e.g. under a test runner that imports main multiple times).
    root.handlers.clear()
    root.addHandler(handler)

    # Quiet down noisy third-party loggers unless we're at DEBUG.
    if level > logging.DEBUG:
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
        logging.getLogger("asyncpg").setLevel(logging.WARNING)

    _CONFIGURED = True
