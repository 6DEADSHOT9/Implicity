import asyncio
import logging
import os
from contextlib import asynccontextmanager

from anyio import Lock, create_task_group, sleep_forever
from anyio.abc import TaskGroup, TaskStatus
from fastapi import FastAPI
from starlette.applications import Starlette
from starlette.routing import Route
from starlette.types import ASGIApp, Receive, Scope, Send

from implicity_api.backup import daily_backups
from implicity_api.stores.app import discard_unattached_message_specs

logger = logging.getLogger(__name__)
MCP_PATH = "/mcp"


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
    mcp_http: ASGIApp | None = None
    mcp_start: tuple[TaskGroup, Lock] | None = None

    def create_mcp_transport():
        from mcp.server.transport_security import TransportSecuritySettings

        from implicity_api.mcp import create_server

        server = create_server()
        transport = server.streamable_http_app(
            streamable_http_path=MCP_PATH,
            transport_security=TransportSecuritySettings(allowed_hosts=allowed_hosts),
        )
        return server, transport

    async def run_mcp(*, task_status: TaskStatus[ASGIApp]) -> None:
        server, transport = await asyncio.to_thread(create_mcp_transport)
        async with server.session_manager.run():
            task_status.started(transport)
            await sleep_forever()

    class MCPTransport:
        async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
            nonlocal mcp_http
            if mcp_start is None:
                raise RuntimeError("MCP requires the API lifespan")
            task_group, lock = mcp_start
            async with lock:
                if mcp_http is None:
                    mcp_http = await task_group.start(run_mcp)
            await mcp_http(scope, receive, send)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        nonlocal mcp_http, mcp_start
        async with create_task_group() as task_group:
            await cleanup_message_specs()
            tasks = [
                asyncio.create_task(daily_backups()),
                asyncio.create_task(daily_message_spec_cleanup()),
            ]
            mcp_start = task_group, Lock()
            try:
                yield
            finally:
                for task in tasks:
                    task.cancel()
                await asyncio.gather(*tasks, return_exceptions=True)
                task_group.cancel_scope.cancel()
                mcp_http = None
                mcp_start = None

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.mount("/", Starlette(routes=[Route(MCP_PATH, MCPTransport())]))
    return app


app = create_app()
