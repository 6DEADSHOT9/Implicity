import asyncio
import json
import os
import uuid
from collections.abc import AsyncIterator
from contextlib import aclosing, suppress
from typing import Any

import httpx

from implicity_api.models.agent import AgentSession
from implicity_api.stores.agent import store

AI_SDK_STREAM_HEADERS = {"x-vercel-ai-ui-message-stream": "v1"}
SKILLS = frozenset(
    {
        "propose-workflow",
        "propose-widget",
        "propose-look",
        "propose-kind",
        "extract-memory",
    }
)


def _sse(part: dict[str, Any]) -> str:
    return f"data: {json.dumps(part, separators=(',', ':'), allow_nan=False)}\n\n"


class HermesAgent:
    def __init__(
        self,
        agent_store=store,
        base_url: str | None = None,
        api_key: str | None = None,
    ):
        self._store = agent_store
        self._base_url = (
            base_url or os.getenv("HERMES_URL", "http://hermes:8642")
        ).rstrip("/")
        self._api_key = (
            api_key if api_key is not None else os.getenv("HERMES_API_KEY", "")
        )
        self._active: dict[str, asyncio.Event] = {}
        self._instructions: dict[str, str] = {}

    def start_conversation(self, conversation_id: str, context: str = "") -> None:
        conversation_id = str(uuid.UUID(conversation_id))
        session = self._store.get(AgentSession, conversation_id)
        if session is None:
            self._store.insert(
                AgentSession(
                    id=conversation_id,
                    session_id=conversation_id,
                    data={"hermes_session_id": str(uuid.uuid4())},
                )
            )
        self._instructions[conversation_id] = context

    def cancel(self, conversation_id: str) -> None:
        active = self._active.get(str(uuid.UUID(conversation_id)))
        if active:
            active.set()

    async def run_skill(self, skill: str, inputs: dict[str, Any]) -> dict[str, Any]:
        if skill not in SKILLS:
            raise ValueError("Unknown skill")
        if not self._api_key:
            raise RuntimeError("Hermes API key is not configured")
        payload = {
            "model": "hermes-agent",
            "conversation": str(uuid.uuid4()),
            "input": json.dumps(inputs, separators=(",", ":"), allow_nan=False),
            "instructions": (
                f"Use the installed Hermes skill `{skill}` for this request. "
                "Return its structured result."
            ),
            "stream": False,
            "store": True,
        }
        async with httpx.AsyncClient(timeout=None) as client:
            response = await client.post(
                f"{self._base_url}/v1/responses",
                headers={"Authorization": f"Bearer {self._api_key}"},
                json=payload,
            )
            response.raise_for_status()
            return response.json()

    async def send(
        self, conversation_id: str, message: str
    ) -> AsyncIterator[dict[str, Any]]:
        conversation_id = str(uuid.UUID(conversation_id))
        session = self._store.get(AgentSession, conversation_id)
        if session is None:
            raise ValueError("Conversation has not been started")
        if not self._api_key:
            raise RuntimeError("Hermes API key is not configured")

        cancelled = asyncio.Event()
        self._active[conversation_id] = cancelled
        headers = {"Authorization": f"Bearer {self._api_key}"}
        payload = {
            "model": "hermes-agent",
            "conversation": session.data["hermes_session_id"],
            "input": message,
            "stream": True,
            "store": True,
        }
        if self._instructions.get(conversation_id):
            payload["instructions"] = self._instructions[conversation_id]

        text_ids: set[str] = set()
        reasoning_ids: set[str] = set()
        tool_calls: dict[str, str] = {}
        ended: set[tuple[str, str]] = set()
        read_task = None
        cancel_task = asyncio.create_task(cancelled.wait())
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream(
                    "POST",
                    f"{self._base_url}/v1/responses",
                    headers=headers,
                    json=payload,
                ) as response:
                    response.raise_for_status()
                    lines = response.aiter_lines().__aiter__()
                    data_lines = []
                    read_task = asyncio.create_task(anext(lines))
                    while True:
                        done, _ = await asyncio.wait(
                            (read_task, cancel_task),
                            return_when=asyncio.FIRST_COMPLETED,
                        )
                        if cancel_task in done:
                            read_task.cancel()
                            with suppress(asyncio.CancelledError, StopAsyncIteration):
                                await read_task
                            yield {"type": "abort", "reason": "user cancelled"}
                            yield {"type": "finish"}
                            return
                        try:
                            line = read_task.result()
                        except StopAsyncIteration:
                            break
                        read_task = asyncio.create_task(anext(lines))
                        if line.startswith("data:"):
                            data_lines.append(line[5:].lstrip())
                            continue
                        if line or not data_lines:
                            continue
                        raw = "\n".join(data_lines)
                        data_lines.clear()
                        if raw == "[DONE]":
                            break
                        event = json.loads(raw)
                        event_type = event.get("type")
                        item = event.get("item") or {}
                        item_type = item.get("type")
                        item_id = str(item.get("id") or event.get("item_id") or "")
                        parts = []
                        if event_type == "response.created":
                            parts.append(
                                {"type": "start", "messageId": event["response"]["id"]}
                            )
                        elif (
                            event_type == "response.output_item.added"
                            and item_type == "message"
                        ):
                            if item_id:
                                text_ids.add(item_id)
                                parts.append({"type": "text-start", "id": item_id})
                        elif event_type == "response.reasoning_summary_part.added":
                            item_id = str(
                                event.get("item_id")
                                or f"reasoning-{event.get('output_index', 0)}"
                            )
                            reasoning_ids.add(item_id)
                            parts.append({"type": "reasoning-start", "id": item_id})
                        elif (
                            event_type == "response.output_item.added"
                            and item_type == "function_call"
                        ):
                            call_id = str(item.get("call_id") or item_id)
                            tool_calls[call_id] = item.get("name", "")
                            parts.append(
                                {
                                    "type": "tool-input-start",
                                    "toolCallId": call_id,
                                    "toolName": tool_calls[call_id],
                                }
                            )
                        elif event_type == "response.output_text.delta":
                            item_id = str(event.get("item_id") or "")
                            if item_id and item_id not in text_ids:
                                text_ids.add(item_id)
                                parts.append({"type": "text-start", "id": item_id})
                            if item_id:
                                parts.append(
                                    {
                                        "type": "text-delta",
                                        "id": item_id,
                                        "delta": event.get("delta", ""),
                                    }
                                )
                        elif event_type == "response.output_text.done":
                            item_id = str(event.get("item_id") or "")
                            if item_id and ("text", item_id) not in ended:
                                text_ids.add(item_id)
                                ended.add(("text", item_id))
                                parts.append({"type": "text-end", "id": item_id})
                        elif event_type == "response.reasoning_summary_text.delta":
                            item_id = str(
                                event.get("item_id")
                                or f"reasoning-{event.get('output_index', 0)}"
                            )
                            if item_id not in reasoning_ids:
                                reasoning_ids.add(item_id)
                                parts.append({"type": "reasoning-start", "id": item_id})
                            parts.append(
                                {
                                    "type": "reasoning-delta",
                                    "id": item_id,
                                    "delta": event.get("delta", ""),
                                }
                            )
                        elif event_type == "response.reasoning_summary_part.done":
                            item_id = str(
                                event.get("item_id")
                                or f"reasoning-{event.get('output_index', 0)}"
                            )
                            if ("reasoning", item_id) not in ended:
                                reasoning_ids.add(item_id)
                                ended.add(("reasoning", item_id))
                                parts.append({"type": "reasoning-end", "id": item_id})
                        elif (
                            event_type == "response.output_item.done"
                            and item_type == "message"
                        ):
                            if item_id and ("text", item_id) not in ended:
                                text_ids.add(item_id)
                                ended.add(("text", item_id))
                                parts.append({"type": "text-end", "id": item_id})
                        elif (
                            event_type == "response.output_item.done"
                            and item_type == "function_call"
                        ):
                            call_id = str(item.get("call_id") or item_id)
                            tool_name = str(
                                item.get("name") or tool_calls.get(call_id, "")
                            )
                            raw_input = item.get("arguments", "{}")
                            try:
                                tool_input = (
                                    json.loads(raw_input)
                                    if isinstance(raw_input, str)
                                    else raw_input
                                )
                            except json.JSONDecodeError:
                                tool_input = raw_input
                            parts.append(
                                {
                                    "type": "tool-input-available",
                                    "toolCallId": call_id,
                                    "toolName": tool_name,
                                    "input": tool_input,
                                }
                            )
                        elif (
                            event_type == "response.output_item.done"
                            and item_type == "function_call_output"
                        ):
                            parts.append(
                                {
                                    "type": "tool-output-available",
                                    "toolCallId": item.get("call_id", ""),
                                    "output": item.get("output"),
                                }
                            )
                        elif event_type in {"response.failed", "response.incomplete"}:
                            for text_id in text_ids:
                                if ("text", text_id) not in ended:
                                    ended.add(("text", text_id))
                                    parts.append({"type": "text-end", "id": text_id})
                            for reasoning_id in reasoning_ids:
                                if ("reasoning", reasoning_id) not in ended:
                                    ended.add(("reasoning", reasoning_id))
                                    parts.append(
                                        {"type": "reasoning-end", "id": reasoning_id}
                                    )
                            parts.append(
                                {
                                    "type": "error",
                                    "errorText": (
                                        "The agent could not finish this turn."
                                    ),
                                }
                            )
                            parts.append({"type": "finish"})
                            for part in parts:
                                yield part
                            return
                        elif event_type == "response.completed":
                            for text_id in text_ids:
                                if ("text", text_id) not in ended:
                                    ended.add(("text", text_id))
                                    parts.append({"type": "text-end", "id": text_id})
                            for reasoning_id in reasoning_ids:
                                if ("reasoning", reasoning_id) not in ended:
                                    ended.add(("reasoning", reasoning_id))
                                    parts.append(
                                        {"type": "reasoning-end", "id": reasoning_id}
                                    )
                            parts.append({"type": "finish"})
                        for part in parts:
                            yield part
                        if event_type == "response.completed":
                            return
        except httpx.HTTPError:
            yield {
                "type": "error",
                "errorText": "The agent could not finish this turn.",
            }
            yield {"type": "finish"}
        finally:
            cancel_task.cancel()
            if read_task and not read_task.done():
                read_task.cancel()
            await asyncio.gather(
                cancel_task,
                *(task for task in (read_task,) if task is not None),
                return_exceptions=True,
            )
            self._active.pop(conversation_id, None)


async def stream_sse(agent: HermesAgent, conversation_id: str, message: str):
    async with aclosing(agent.send(conversation_id, message)) as parts:
        async for part in parts:
            yield _sse(part)
        yield "data: [DONE]\n\n"


__all__ = ["AI_SDK_STREAM_HEADERS", "HermesAgent", "stream_sse", "store"]
