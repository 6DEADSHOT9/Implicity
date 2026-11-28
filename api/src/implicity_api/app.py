import asyncio
import json
import logging
import os
import traceback
import uuid
from contextlib import asynccontextmanager
from dataclasses import asdict

from anyio import Lock, create_task_group, sleep_forever
from anyio.abc import TaskGroup, TaskStatus
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from starlette.applications import Starlette
from starlette.routing import Route
from starlette.types import ASGIApp, Receive, Scope, Send

from implicity_api.backup import daily_backups
from implicity_api.modules.agent import (
    AI_SDK_STREAM_HEADERS,
    HermesAgent,
    UserMessage,
    stream_parts_sse,
)
from implicity_api.modules.app import (
    MessageAlreadyHasSpecError,
    MessageSpecAlreadyAttachedError,
    MessageSpecNotFoundError,
    attach_message_spec,
    discard_unattached_message_specs,
    store as app_store,
)
from implicity_api.modules.app.chat import (
    conversation_exists,
    create_conversation,
    get_conversation,
    list_conversations,
    save_message,
)

logger = logging.getLogger(__name__)
MCP_PATH = "/mcp"


class _AdmittedStreamingResponse(StreamingResponse):
    def __init__(self, content, *, release, on_disconnect, **kwargs):
        super().__init__(content, **kwargs)
        self.release = release
        self.on_disconnect = on_disconnect

    async def __call__(self, scope, receive, send):
        try:
            await super().__call__(scope, receive, send)
        except BaseException:
            self.on_disconnect()
            close = getattr(self.body_iterator, "aclose", None)
            if close:
                try:
                    await close()
                except BaseException:
                    pass
            raise
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
    agent = chat_agent or HermesAgent()
    conversation_store = app_store_override or app_store

    @app.get("/health")
    async def health() -> dict[str, str]:
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

        disconnect_state = {"disconnected": False}

        async def relay():
            answer = []
            text_part_id = None
            render_calls = set()
            rendered_spec_ids = []
            completed = False
            partial_persist_attempted = False

            def save_result():
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
                    except (
                        MessageSpecNotFoundError,
                        MessageSpecAlreadyAttachedError,
                        MessageAlreadyHasSpecError,
                    ):
                        continue

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
                            if tool_name == "mcp__implicity__render":
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
                disconnect_state["disconnected"] = True
                raise
            except Exception as error:
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
                stream_error = message
            else:
                stream_error = None

            persistence_failed = False
            if answer or rendered_spec_ids:
                try:
                    save_result()
                except Exception as error:
                    persistence_failed = True
                    _log_chat_failure(
                        "Could not persist assistant result",
                        error,
                        conversation_id,
                        session_id,
                    )
            release()
            if persistence_failed:
                stream_error = "Could not save the answer. Try again."
            if stream_error:
                for part in (
                    {"type": "error", "errorText": stream_error},
                    {"type": "finish"},
                ):
                    yield f"data: {json.dumps(part, separators=(',', ':'))}\n\n"
                yield "data: [DONE]\n\n"
            elif completed:
                yield 'data: {"type":"finish"}\n\n'
                yield "data: [DONE]\n\n"
            finally:
                if disconnect_state["disconnected"] and not completed:
                    agent.cancel(conversation_id)
                    if (answer or rendered_spec_ids) and not partial_persist_attempted:
                        partial_persist_attempted = True
                        try:
                            save_result()
                        except Exception as error:
                            _log_chat_failure(
                                "Could not persist partial assistant result",
                                error,
                                conversation_id,
                                session_id,
                            )

        return _AdmittedStreamingResponse(
            relay(),
            release=release,
            on_disconnect=lambda: disconnect_state.__setitem__("disconnected", True),
            media_type="text/event-stream",
            headers=AI_SDK_STREAM_HEADERS,
        )

    app.mount("/", Starlette(routes=[Route(MCP_PATH, MCPTransport())]))
    return app


app = create_app()
