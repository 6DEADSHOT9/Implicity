import asyncio
import json
import logging
import os
import uuid
from contextlib import AsyncExitStack, asynccontextmanager
from dataclasses import asdict

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from mcp.server.transport_security import TransportSecuritySettings

from implicity_api.backup import daily_backups
from implicity_api.mcp import create_server
from implicity_api.modules.agent import (
    AI_SDK_STREAM_HEADERS,
    HermesAgent,
    UserMessage,
    stream_sse,
)
from implicity_api.modules.app import discard_unattached_message_specs
from implicity_api.modules.app.chat import (
    create_conversation,
    get_conversation,
    list_conversations,
    save_message,
)
from implicity_api.stores.app import store as app_store

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


def create_app(
    allowed_hosts: list[str] | None = None,
    *,
    chat_agent=None,
    app_store_override=None,
) -> FastAPI:
    if allowed_hosts is None:
        allowed_hosts = os.getenv(
            "MCP_ALLOWED_HOSTS", "localhost:*,127.0.0.1:*,[::1]:*"
        ).split(",")
    mcp_server = create_server()
    mcp_http = mcp_server.streamable_http_app(
        transport_security=TransportSecuritySettings(allowed_hosts=allowed_hosts)
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
    agent = chat_agent or HermesAgent()
    conversation_store = app_store_override or app_store

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/quota")
    def quota() -> dict:
        return asdict(agent.quota())

    @app.post("/api/conversations")
    def new_conversation() -> dict:
        conversation = create_conversation(conversation_store)
        agent.start_conversation(conversation.id)
        return {"id": conversation.id, **conversation.data}

    @app.get("/api/conversations")
    def conversations() -> list[dict]:
        return list_conversations(conversation_store)

    @app.get("/api/conversations/{conversation_id}")
    def conversation(conversation_id: str) -> dict:
        try:
            result = get_conversation(conversation_store, conversation_id)
        except ValueError as error:
            raise HTTPException(
                status_code=422, detail="Invalid conversation id"
            ) from error
        if result is None:
            raise HTTPException(status_code=404, detail="Conversation does not exist")
        return result

    @app.post("/api/chat")
    async def chat(body: dict):
        try:
            conversation_id = str(uuid.UUID(body.get("id", "")))
        except (AttributeError, TypeError, ValueError) as error:
            raise HTTPException(
                status_code=422, detail="Invalid conversation id"
            ) from error
        if get_conversation(conversation_store, conversation_id) is None:
            raise HTTPException(status_code=404, detail="Conversation does not exist")
        messages = body.get("messages")
        last = messages[-1] if isinstance(messages, list) and messages else None
        if not isinstance(last, dict) or last.get("role") != "user":
            raise HTTPException(
                status_code=422, detail="The last message must be from the user"
            )
        parts = last.get("parts")
        text = "".join(
            part.get("text", "")
            for part in parts or []
            if isinstance(part, dict)
            and part.get("type") == "text"
            and isinstance(part.get("text"), str)
        )
        if not text.strip():
            raise HTTPException(status_code=422, detail="A text message is required")
        save_message(conversation_store, conversation_id, "user", text)

        async def relay():
            answer = []
            try:
                async for event in stream_sse(
                    agent, conversation_id, UserMessage(text)
                ):
                    for line in event.splitlines():
                        if not line.startswith("data: ") or line[6:] == "[DONE]":
                            continue
                        try:
                            part = json.loads(line[6:])
                        except json.JSONDecodeError:
                            continue
                        if part.get("type") == "text-delta":
                            answer.append(part.get("delta", ""))
                    yield event
            except asyncio.CancelledError:
                agent.cancel(conversation_id)
                raise
            finally:
                if answer:
                    save_message(
                        conversation_store,
                        conversation_id,
                        "assistant",
                        "".join(answer),
                    )

        return StreamingResponse(
            relay(), media_type="text/event-stream", headers=AI_SDK_STREAM_HEADERS
        )

    app.mount("/", mcp_http)
    return app


app = create_app()
