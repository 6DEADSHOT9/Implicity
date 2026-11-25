import asyncio
import logging
import os
from contextlib import AsyncExitStack, asynccontextmanager

from fastapi import FastAPI
from mcp.server.transport_security import TransportSecuritySettings

from implicity_api.backup import daily_backups
from implicity_api.mcp import create_server
from implicity_api.modules.app import discard_unattached_message_specs

logger = logging.getLogger(__name__)


async def cleanup_message_specs() -> None:
    # shortcut: one worker thread; revisit if expiry volume grows.
    try:
        await asyncio.to_thread(discard_unattached_message_specs)
    except Exception:
        logger.exception("Unattached message spec cleanup failed")


async def daily_message_spec_cleanup() -> None:
    while True:
        await asyncio.sleep(24 * 60 * 60)
        await cleanup_message_specs()


def create_app(allowed_hosts: list[str] | None = None) -> FastAPI:
    if allowed_hosts is None:
        allowed_hosts = os.getenv(
            "MCP_ALLOWED_HOSTS", "localhost:*,127.0.0.1:*,[::1]:*"
        ).split(",")
    mcp_server = create_server()
    mcp_http = mcp_server.streamable_http_app(
        transport_security=TransportSecuritySettings(
            allowed_hosts=allowed_hosts
        )
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        async with AsyncExitStack() as stack:
            await stack.enter_async_context(mcp_server.session_manager.run())
            await cleanup_message_specs()
            tasks = [
                asyncio.create_task(daily_backups()),
                asyncio.create_task(daily_message_spec_cleanup()),
            ]
            try:
                yield
            finally:
                for task in tasks:
                    task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.mount("/", mcp_http)
    return app


app = create_app()
