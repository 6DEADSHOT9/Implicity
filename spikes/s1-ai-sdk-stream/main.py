import asyncio
import json
import os
import re
import uuid
from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

app = FastAPI()
sessions = set()


def part(obj):
    return b"data: " + json.dumps(obj, separators=(",", ":")).encode() + b"\n\n"


@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    chat_id = body.get("chatId", "default")
    capture_case = re.sub(r"[^a-z0-9-]", "-", body.get("captureCase", "session").lower())
    last = body["messages"][-1]
    text = "".join(p.get("text", "") for p in last.get("parts", []) if p.get("type") == "text")
    base = os.getenv("HERMES_URL", "http://127.0.0.1:8642")
    headers = {"Authorization": f"Bearer {os.environ['HERMES_API_KEY']}"}

    async def stream():
        message_id = str(uuid.uuid4())
        tool_ids = {}
        reasoning_started = False
        capture = Path("captures") / f"session-{capture_case}.sse"
        yield part({"type": "start", "messageId": message_id})
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                if chat_id not in sessions:
                    created = await client.post(f"{base}/api/sessions", headers=headers,
                                                json={"id": chat_id})
                    created.raise_for_status()
                    sessions.add(chat_id)
                turn = {"input": text}
                if capture_case == "reasoning":
                    turn["model_options"] = {"reasoning": {"enabled": True, "effort": "high"}}
                async with client.stream("POST", f"{base}/api/sessions/{chat_id}/chat/stream",
                    headers=headers, json=turn) as response:
                    response.raise_for_status()
                    with capture.open("w") as raw:
                        event_name = "message"
                        async for line in response.aiter_lines():
                            if line.startswith("event: "):
                                event_name = line[7:]
                                continue
                            if not line.startswith("data: ") or line[6:] == "[DONE]":
                                continue
                            raw.write(f"event: {event_name}\ndata: {line[6:]}\n\n")
                            raw.flush()
                            event = json.loads(line[6:])
                            typ = event_name
                            if typ == "message.started":
                                yield part({"type": "text-start", "id": message_id})
                            elif typ == "assistant.delta":
                                yield part({"type": "text-delta", "id": message_id, "delta": event.get("delta", "")})
                            elif typ == "assistant.completed":
                                yield part({"type": "text-end", "id": message_id})
                            elif typ == "tool.progress" and event.get("tool_name") == "_thinking":
                                if not reasoning_started:
                                    yield part({"type": "reasoning-start", "id": message_id + "-reasoning"})
                                    reasoning_started = True
                                yield part({"type": "reasoning-delta", "id": message_id + "-reasoning", "delta": event.get("delta", "")})
                            elif typ == "tool.started":
                                tool_name = event.get("tool_name") or "unknown"
                                call_id = str(uuid.uuid4())
                                tool_ids.setdefault(tool_name, []).append(call_id)
                                yield part({"type": "tool-input-start", "toolCallId": call_id, "toolName": tool_name})
                                args = event.get("args")
                                yield part({"type": "tool-input-available", "toolCallId": call_id,
                                            "toolName": tool_name, "input": args if args is not None else {}})
                            elif typ == "run.completed":
                                for message in event.get("messages", []):
                                    if message.get("role") != "tool":
                                        continue
                                    tool_name = message.get("tool_name") or "unknown"
                                    ids = tool_ids.get(tool_name) or []
                                    call_id = ids.pop(0) if ids else str(uuid.uuid4())
                                    output = message.get("content")
                                    try:
                                        output = json.loads(output)
                                    except (TypeError, json.JSONDecodeError):
                                        pass
                                    yield part({"type": "tool-output-available", "toolCallId": call_id, "output": output})
                                if reasoning_started:
                                    yield part({"type": "reasoning-end", "id": message_id + "-reasoning"})
                                yield part({"type": "finish"})
                            elif typ in {"run.failed", "run.cancelled", "error"}:
                                if reasoning_started:
                                    yield part({"type": "reasoning-end", "id": message_id + "-reasoning"})
                                yield part({"type": "error", "errorText": json.dumps(event)})
                                yield part({"type": "finish"})
                    yield b"data: [DONE]\n\n"
        except asyncio.CancelledError:
            raise
        except Exception as e:
            yield part({"type": "error", "errorText": str(e)})
            yield part({"type": "finish"})
            yield b"data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"x-vercel-ai-ui-message-stream": "v1", "cache-control": "no-cache"})
