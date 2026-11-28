import asyncio
import json
import logging
import os
import traceback
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
    stream_parts_sse,
)
from implicity_api.modules.app import (
    MessageSpecNotFoundError,
    attach_message_spec,
    discard_unattached_message_specs,
)
from implicity_api.modules.app.chat import (
    conversation_exists,
    create_conversation,
    get_conversation,
    list_conversations,
    save_message,
)
from implicity_api.stores.app import store as app_store

logger = logging.getLogger(__name__)


class _AdmittedStreamingResponse(StreamingResponse):
    def __init__(self, content, *, release, **kwargs):
        super().__init__(content, **kwargs)
        self.release = release

    async def __call__(self, scope, receive, send):
        try:
            await super().__call__(scope, receive, send)
        finally:
            self.release()


def _rendered_spec_id(value, depth=0):
    if depth > 5:
        return None
    if isinstance(value, dict):
        if isinstance(value.get("id"), str):
            return value["id"]
        for key in ("result", "text", "content", "output"):
            if key in value:
                found = _rendered_spec_id(value[key], depth + 1)
                if found:
                    return found
    elif isinstance(value, list):
        for item in value:
            found = _rendered_spec_id(item, depth + 1)
            if found:
                return found
    elif isinstance(value, str):
        try:
            return _rendered_spec_id(json.loads(value), depth + 1)
        except json.JSONDecodeError:
            return None
    return None


def _chat_error_response(message):
    async def events():
        for part in (
            {"type": "error", "errorText": message},
            {"type": "finish"},
        ):
            yield f"data: {json.dumps(part, separators=(',', ':'))}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        events(), media_type="text/event-stream", headers=AI_SDK_STREAM_HEADERS
    )


def _log_chat_failure(message, error, conversation_id, session_id):
    stack = " <- ".join(
        f"{frame.filename}:{frame.lineno} in {frame.name}"
        for frame in traceback.extract_tb(error.__traceback__)
    )
    logger.error(
        "%s for conversation %s session %s (%s): %s",
        message,
        conversation_id,
        session_id,
        type(error).__name__,
        stack,
    )


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
        try:
            session_id = str(uuid.UUID(body.get("session_id", "")))
        except (AttributeError, TypeError, ValueError) as error:
            raise HTTPException(status_code=422, detail="Invalid session id") from error
        if not conversation_exists(conversation_store, conversation_id):
            raise HTTPException(status_code=404, detail="Conversation does not exist")
        messages = body.get("messages")
        last = messages[-1] if isinstance(messages, list) and messages else None
        if not isinstance(last, dict) or last.get("role") != "user":
            raise HTTPException(
                status_code=422, detail="The last message must be from the user"
            )
        parts = last.get("parts")
        if not isinstance(parts, list) or any(
            not isinstance(part, dict)
            or part.get("type") != "text"
            or not isinstance(part.get("text"), str)
            for part in parts
        ):
            raise HTTPException(status_code=422, detail="Message parts must be text")
        text = "".join(part["text"] for part in parts)
        if not text.strip():
            raise HTTPException(status_code=422, detail="A text message is required")

        try:
            agent_parts, release = agent.admit(conversation_id, UserMessage(text))
        except Exception as error:
            if isinstance(error, (RuntimeError, ValueError)):
                if str(error) == "Hermes API key is not configured":
                    return _chat_error_response("Hermes API key is not configured.")
                if str(error) == "Conversation is already streaming":
                    return _chat_error_response(
                        "This conversation is already responding."
                    )
            _log_chat_failure(
                "Chat admission failed", error, conversation_id, session_id
            )
            return _chat_error_response(
                "The agent could not start this turn. Check Hermes and try again."
            )

        try:
            save_message(conversation_store, conversation_id, session_id, "user", text)
        except Exception:
            release()
            raise

        async def relay():
            answer = []
            text_part_id = None
            render_calls = set()
            rendered_spec_ids = []
            completed = False
            failed = False
            try:
                async for event in stream_parts_sse(agent_parts):
                    terminal = False
                    for line in event.splitlines():
                        if not line.startswith("data: "):
                            continue
                        if line[6:] == "[DONE]":
                            terminal = True
                            continue
                        try:
                            part = json.loads(line[6:])
                        except json.JSONDecodeError:
                            continue
                        if part.get("type") == "finish":
                            terminal = True
                            break
                        if part.get("type") == "text-delta":
                            if text_part_id is not None and text_part_id != part.get(
                                "id"
                            ):
                                answer.append("\n\n")
                            answer.append(part.get("delta", ""))
                            text_part_id = part.get("id")
                        if part.get("type") in {
                            "tool-input-start",
                            "tool-input-available",
                        }:
                            tool_name = str(part.get("toolName", ""))
                            if tool_name == "mcp__render":
                                render_calls.add(part.get("toolCallId"))
                        if (
                            part.get("type") == "tool-output-available"
                            and part.get("toolCallId") in render_calls
                        ):
                            spec_id = _rendered_spec_id(part.get("output"))
                            if spec_id and spec_id not in rendered_spec_ids:
                                rendered_spec_ids.append(spec_id)
                    if terminal:
                        completed = True
                        break
                    yield event
            except asyncio.CancelledError:
                agent.cancel(conversation_id)
                raise
            except Exception as error:
                failed = True
                if str(error) in {
                    "Hermes API key is not configured",
                    "Conversation is already streaming",
                }:
                    message = (
                        "Hermes API key is not configured."
                        if str(error) == "Hermes API key is not configured"
                        else "This conversation is already responding."
                    )
                else:
                    _log_chat_failure(
                        "Chat relay failed", error, conversation_id, session_id
                    )
                    message = "The answer could not be loaded. Try again."
                for part in (
                    {"type": "error", "errorText": message},
                    {"type": "finish"},
                ):
                    yield f"data: {json.dumps(part, separators=(',', ':'))}\n\n"
                yield "data: [DONE]\n\n"
            finally:
                if completed and (answer or rendered_spec_ids):
                    try:
                        assistant_message = save_message(
                            conversation_store,
                            conversation_id,
                            session_id,
                            "assistant",
                            "".join(answer),
                        )
                        for spec_id in rendered_spec_ids:
                            try:
                                attach_message_spec(
                                    assistant_message.id, spec_id, conversation_store
                                )
                                break
                            except MessageSpecNotFoundError:
                                continue
                    except Exception as error:
                        _log_chat_failure(
                            "Could not persist assistant result",
                            error,
                            conversation_id,
                            session_id,
                        )
                        for part in (
                            {
                                "type": "error",
                                "errorText": "Could not save the answer. Try again.",
                            },
                            {"type": "finish"},
                        ):
                            yield f"data: {json.dumps(part, separators=(',', ':'))}\n\n"
                        yield "data: [DONE]\n\n"
                        return
                elif not completed and (answer or rendered_spec_ids):
                    try:
                        save_message(
                            conversation_store,
                            conversation_id,
                            session_id,
                            "assistant",
                            "".join(answer),
                        )
                    except Exception as error:
                        _log_chat_failure(
                            "Could not persist partial assistant result",
                            error,
                            conversation_id,
                            session_id,
                        )
                    return
                if failed:
                    return
                release()
                yield 'data: {"type":"finish"}\n\n'
                yield "data: [DONE]\n\n"

        return _AdmittedStreamingResponse(
            relay(),
            release=release,
            media_type="text/event-stream",
            headers=AI_SDK_STREAM_HEADERS,
        )

    app.mount("/", mcp_http)
    return app


app = create_app()
