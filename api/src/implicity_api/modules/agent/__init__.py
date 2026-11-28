import asyncio
import json
import math
import os
import threading
import time
import uuid
from collections.abc import AsyncIterator
from contextlib import aclosing, suppress
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

import httpx

from implicity_api.models.agent import (
    AgentSession,
    QuotaLog,
)
from implicity_api.models.agent import (
    QuotaSettings as QuotaSettingsRow,
)
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
_SETTINGS_ID = "default"
TurnType = Literal["chat", "background"]


@dataclass(frozen=True, slots=True)
class PromptContext:
    memory: str = ""
    explicit_preferences: str = ""
    answer_style: str = ""
    deleted_draft: str | None = None
    current_state_instructions: str = ""


@dataclass(frozen=True, slots=True)
class UserMessage:
    text: str


@dataclass(frozen=True, slots=True)
class SkillResult:
    response: dict[str, Any]


@dataclass(frozen=True, slots=True)
class QuotaWindow:
    label: str
    used_percent: float
    resets_at: str


@dataclass(frozen=True, slots=True)
class Quota:
    state: Literal["ok", "near_limit", "limited", "unknown"]
    windows: tuple[QuotaWindow, ...]
    resets_at: str | None
    checked_at: str


@dataclass(frozen=True, slots=True)
class QuotaSettings:
    daily_background_token_cap: int = 200_000
    near_limit_threshold_percent: int = 90


def _validate_settings(settings: QuotaSettings) -> QuotaSettings:
    if not isinstance(settings, QuotaSettings):
        raise TypeError("settings must be QuotaSettings")
    cap = settings.daily_background_token_cap
    threshold = settings.near_limit_threshold_percent
    if isinstance(cap, bool) or not isinstance(cap, int) or cap < 0:
        raise ValueError("Invalid daily background token cap")
    if (
        isinstance(threshold, bool)
        or not isinstance(threshold, int)
        or not 0 <= threshold <= 100
    ):
        raise ValueError("Invalid near-limit threshold percent")
    return settings


def _timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return result if result.tzinfo is not None else None


def _parse_usage(
    payload: Any,
) -> tuple[list[dict[str, Any]], dict[str, Any] | None] | None:
    if not isinstance(payload, dict) or not isinstance(payload.get("providers"), list):
        return None
    current = next(
        (
            row
            for row in payload["providers"]
            if isinstance(row, dict) and row.get("is_current") is True
        ),
        None,
    )
    if current is None:
        return None
    usage = current.get("usage")
    if usage is None:
        raw_windows = []
    elif isinstance(usage, dict) and isinstance(usage.get("windows"), list):
        raw_windows = usage["windows"]
    else:
        return None
    windows = []
    for window in raw_windows:
        if not isinstance(window, dict):
            return None
        if window.get("scope") != "account":
            continue
        percent = window.get("used_percent")
        if (
            not isinstance(window.get("label"), str)
            or isinstance(percent, bool)
            or not isinstance(percent, (int, float))
            or not math.isfinite(percent)
            or not 0 <= percent <= 100
            or _timestamp(window.get("resets_at")) is None
        ):
            return None
        windows.append(
            {
                "label": window["label"],
                "used_percent": percent,
                "resets_at": window["resets_at"],
            }
        )
    limit = current.get("limit")
    if limit is not None:
        if not isinstance(limit, dict) or not isinstance(limit.get("scope"), str):
            return None
        if limit["scope"] != "account":
            limit = None
        elif (
            limit.get("resets_at") is not None
            and _timestamp(limit["resets_at"]) is None
        ):
            return None
    return windows, limit


def _sse(part: dict[str, Any]) -> str:
    return f"data: {json.dumps(part, separators=(',', ':'), allow_nan=False)}\n\n"


def _close_open_parts(
    text_ids: set[str], reasoning_ids: set[str], ended: set[tuple[str, str]]
) -> list[dict[str, str]]:
    parts = []
    for item_id in text_ids:
        if ("text", item_id) not in ended:
            ended.add(("text", item_id))
            parts.append({"type": "text-end", "id": item_id})
    for item_id in reasoning_ids:
        if ("reasoning", item_id) not in ended:
            ended.add(("reasoning", item_id))
            parts.append({"type": "reasoning-end", "id": item_id})
    return parts


def _reasoning_part_id(event: dict[str, Any]) -> str:
    item_id = str(event.get("item_id") or f"reasoning-{event.get('output_index', 0)}")
    return f"{item_id}:{event.get('summary_index', 0)}"


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
        self._active_lock = threading.Lock()
        self._quota_lock = threading.Lock()
        self._quota_last_fetch: float | None = None
        self._quota_checked_at: datetime | None = None
        self._quota_good_at: datetime | None = None
        self._quota_snapshot: (
            tuple[list[dict[str, Any]], dict[str, Any] | None] | None
        ) = None
        self._quota_unknown = True

    def start_conversation(
        self, conversation_id: str, context: PromptContext = PromptContext()
    ) -> None:
        if not isinstance(context, PromptContext):
            raise TypeError("context must be PromptContext")
        conversation_id = str(uuid.UUID(conversation_id))
        session = self._store.get(AgentSession, conversation_id)
        if session is None:
            self._store.insert(
                AgentSession(
                    id=conversation_id,
                    session_id=conversation_id,
                    data={"hermes_session_id": str(uuid.uuid4())},
                    instructions=asdict(context),
                )
            )
        else:
            session.instructions = asdict(context)
            self._store.put(session)

    def cancel(self, conversation_id: str) -> None:
        with self._active_lock:
            active = self._active.get(str(uuid.UUID(conversation_id)))
        if active:
            active.set()

    def quota_settings(self) -> QuotaSettings:
        row = self._store.get(QuotaSettingsRow, _SETTINGS_ID)
        if row is None:
            return QuotaSettings()
        return _validate_settings(QuotaSettings(**row.data))

    def set_quota_settings(self, settings: QuotaSettings) -> QuotaSettings:
        settings = _validate_settings(settings)
        row = self._store.get(QuotaSettingsRow, _SETTINGS_ID)
        if row is None:
            self._store.insert(QuotaSettingsRow(id=_SETTINGS_ID, data=asdict(settings)))
        else:
            row.data = asdict(settings)
            self._store.put(row)
        return settings

    def quota(self) -> Quota:
        return self._read_quota()

    def _read_quota(self, force: bool = False) -> Quota:
        now = datetime.now(timezone.utc)
        monotonic = time.monotonic()
        with self._quota_lock:
            if (
                not force
                and self._quota_last_fetch is not None
                and monotonic - self._quota_last_fetch < 60
            ):
                return self._quota_value(now)
            self._quota_last_fetch = monotonic
            self._quota_checked_at = now
            self._quota_unknown = True
            if not self._api_key:
                return self._quota_value(now)
            try:
                response = httpx.get(
                    f"{self._base_url}/api/model/options",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    timeout=10,
                )
                response.raise_for_status()
                snapshot = _parse_usage(response.json())
            except (httpx.HTTPError, ValueError, TypeError, OverflowError):
                return self._quota_value(now)
            if snapshot is None or (not snapshot[0] and snapshot[1] is None):
                return self._quota_value(now)
            self._quota_snapshot = snapshot
            self._quota_good_at = now
            self._quota_unknown = False
            return self._quota_value(now)

    def _quota_value(self, now: datetime) -> Quota:
        checked_at = self._quota_checked_at or now
        if (
            self._quota_unknown
            or self._quota_snapshot is None
            or self._quota_good_at is None
            or (not self._quota_snapshot[0] and self._quota_snapshot[1] is None)
            or now - self._quota_good_at > timedelta(minutes=15)
        ):
            return Quota("unknown", (), None, checked_at.isoformat())
        windows, limit = self._quota_snapshot
        full = [window for window in windows if window["used_percent"] >= 100]
        settings = self.quota_settings()
        limited = limit is not None or bool(full)
        if limited:
            resets = [
                (_timestamp(window["resets_at"]), window["resets_at"])
                for window in full
            ]
            resets = [entry for entry in resets if entry[0] is not None]
            resets_at = (
                max(resets, key=lambda entry: entry[0])[1]
                if resets
                else limit.get("resets_at")
                if limit is not None
                else None
            )
            state = "limited"
        else:
            resets_at = None
            state = (
                "near_limit"
                if any(
                    window["used_percent"] >= settings.near_limit_threshold_percent
                    for window in windows
                )
                else "ok"
            )
        return Quota(
            state,
            tuple(QuotaWindow(**window) for window in windows),
            resets_at,
            checked_at.isoformat(),
        )

    def may_start_background_work(self) -> bool:
        if self.quota().state != "ok":
            return False
        settings = self.quota_settings()
        today = datetime.now().astimezone().date()
        used = 0
        for row in self._store.list(QuotaLog):
            if row.data.get("type") != "background":
                continue
            logged_at = _timestamp(row.data.get("time"))
            if logged_at and logged_at.astimezone().date() == today:
                used += row.data.get("total_tokens", 0)
        return used < settings.daily_background_token_cap

    def _log_usage(self, conversation_id: str, turn_type: str, usage: Any) -> None:
        if not isinstance(usage, dict):
            return
        tokens = [
            usage.get(name)
            for name in ("input_tokens", "output_tokens", "total_tokens")
        ]
        if any(
            isinstance(value, bool) or not isinstance(value, int) or value < 0
            for value in tokens
        ):
            return
        self._store.insert(
            QuotaLog(
                id=str(uuid.uuid4()),
                session_id=conversation_id,
                data={
                    "time": datetime.now(timezone.utc).isoformat(),
                    "type": turn_type,
                    "conversation_id": conversation_id,
                    "input_tokens": tokens[0],
                    "output_tokens": tokens[1],
                    "total_tokens": tokens[2],
                },
            )
        )

    async def run_skill(self, skill: str, inputs: dict[str, Any]) -> SkillResult:
        if skill not in SKILLS:
            raise ValueError("Unknown skill")
        if not self._api_key:
            raise RuntimeError("Hermes API key is not configured")
        conversation_id = str(uuid.uuid4())
        payload = {
            "model": "hermes-agent",
            "conversation": conversation_id,
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
            result = response.json()
            if result.get("status") == "completed":
                self._log_usage(conversation_id, "background", result.get("usage"))
                await asyncio.to_thread(self.quota)
            return SkillResult(result)

    async def send(
        self, conversation_id: str, message: UserMessage, turn_type: TurnType = "chat"
    ) -> AsyncIterator[dict[str, Any]]:
        if turn_type not in {"chat", "background"}:
            raise ValueError("Invalid turn type")
        if not isinstance(message, UserMessage):
            raise TypeError("message must be UserMessage")
        conversation_id = str(uuid.UUID(conversation_id))
        session = self._store.get(AgentSession, conversation_id)
        if session is None:
            raise ValueError("Conversation has not been started")
        if not self._api_key:
            raise RuntimeError("Hermes API key is not configured")

        cancelled = asyncio.Event()
        with self._active_lock:
            if conversation_id in self._active:
                raise RuntimeError("Conversation is already streaming")
            self._active[conversation_id] = cancelled
        headers = {"Authorization": f"Bearer {self._api_key}"}
        payload = {
            "model": "hermes-agent",
            "conversation": session.data["hermes_session_id"],
            "input": message.text,
            "stream": True,
            "store": True,
        }
        if session.instructions:
            payload["instructions"] = json.dumps(
                session.instructions, separators=(",", ":")
            )

        text_ids: set[str] = set()
        reasoning_ids: set[str] = set()
        tool_calls: dict[str, str] = {}
        ended: set[tuple[str, str]] = set()
        terminal_seen = False
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
                            for part in _close_open_parts(
                                text_ids, reasoning_ids, ended
                            ):
                                yield part
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
                        if not isinstance(event, dict):
                            raise ValueError("Invalid Hermes event")
                        event_type = event.get("type")
                        item = event.get("item") or {}
                        if not isinstance(item, dict):
                            raise ValueError("Invalid Hermes event item")
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
                            item_id = _reasoning_part_id(event)
                            ended.discard(("reasoning", item_id))
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
                            item_id = _reasoning_part_id(event)
                            if item_id not in reasoning_ids:
                                ended.discard(("reasoning", item_id))
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
                            item_id = _reasoning_part_id(event)
                            if (
                                item_id in reasoning_ids
                                and ("reasoning", item_id) not in ended
                            ):
                                ended.add(("reasoning", item_id))
                                reasoning_ids.remove(item_id)
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
                            terminal_seen = True
                            response_data = event.get("response") or {}
                            if not isinstance(response_data, dict):
                                raise ValueError("Invalid Hermes response")
                            self._log_usage(
                                conversation_id,
                                turn_type,
                                response_data.get("usage"),
                            )
                            parts.extend(
                                _close_open_parts(text_ids, reasoning_ids, ended)
                            )
                            quota = (
                                await asyncio.to_thread(self._read_quota, True)
                                if event_type == "response.failed"
                                else await asyncio.to_thread(self.quota)
                            )
                            error = {
                                "type": "error",
                                "errorText": "The agent could not finish this turn.",
                            }
                            if quota is not None:
                                error["quota_state"] = quota.state
                                if quota.state == "limited":
                                    error["resets_at"] = quota.resets_at
                            parts.append(error)
                            parts.append({"type": "finish"})
                            for part in parts:
                                yield part
                            return
                        elif event_type == "response.completed":
                            terminal_seen = True
                            response_data = event.get("response") or {}
                            if not isinstance(response_data, dict):
                                raise ValueError("Invalid Hermes response")
                            self._log_usage(
                                conversation_id,
                                turn_type,
                                response_data.get("usage"),
                            )
                            await asyncio.to_thread(self.quota)
                            parts.extend(
                                _close_open_parts(text_ids, reasoning_ids, ended)
                            )
                            parts.append({"type": "finish"})
                        for part in parts:
                            yield part
                        if event_type == "response.completed":
                            return
            if not terminal_seen:
                for part in _close_open_parts(text_ids, reasoning_ids, ended):
                    yield part
                yield {
                    "type": "error",
                    "errorText": "The agent could not finish this turn.",
                }
                yield {"type": "finish"}
        except (httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError, ValueError):
            for part in _close_open_parts(text_ids, reasoning_ids, ended):
                yield part
            yield {
                "type": "error",
                "errorText": "The agent could not finish this turn.",
            }
            yield {"type": "finish"}
        finally:
            with self._active_lock:
                if self._active.get(conversation_id) is cancelled:
                    self._active.pop(conversation_id, None)
            cancel_task.cancel()
            if read_task and not read_task.done():
                read_task.cancel()
            await asyncio.gather(
                cancel_task,
                *(task for task in (read_task,) if task is not None),
                return_exceptions=True,
            )


async def stream_sse(
    agent: HermesAgent, conversation_id: str, message: UserMessage
) -> AsyncIterator[str]:
    async with aclosing(agent.send(conversation_id, message)) as parts:
        async for part in parts:
            yield _sse(part)
        yield "data: [DONE]\n\n"


__all__ = [
    "AI_SDK_STREAM_HEADERS",
    "HermesAgent",
    "PromptContext",
    "Quota",
    "QuotaSettings",
    "QuotaWindow",
    "SkillResult",
    "TurnType",
    "UserMessage",
    "stream_sse",
    "store",
]
