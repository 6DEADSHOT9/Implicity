import asyncio
import json
import os
import uuid

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

app = FastAPI()
responses = {}


def part(obj):
    return b"data: " + json.dumps(obj, separators=(",", ":")).encode() + b"\n\n"


@app.post("/api/chat")
async def chat(request: Request):
    body = await request.json()
    chat_id = body.get("chatId", "default")
    last = body["messages"][-1]
    text = "".join(p.get("text", "") for p in last.get("parts", []) if p.get("type") == "text")
    previous = responses.get(chat_id)

    async def stream():
        message_id = str(uuid.uuid4())
        yield part({"type": "start", "messageId": message_id})
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", os.getenv("HERMES_URL", "http://127.0.0.1:8642/v1/responses"),
                    headers={"Authorization": f"Bearer {os.environ['HERMES_API_KEY']}"},
                    json={"model": "hermes-agent", "input": text, "previous_response_id": previous,
                          "store": True, "stream": True}) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.startswith("data: ") or line[6:] == "[DONE]":
                            continue
                        event = json.loads(line[6:])
                        typ = event.get("type")
                        if typ == "response.created":
                            responses[chat_id] = event["response"]["id"]
                        elif typ == "response.output_item.added":
                            item = event.get("item", {})
                            kind = item.get("type")
                            if kind == "message":
                                yield part({"type": "text-start", "id": item["id"]})
                            elif kind == "reasoning":
                                yield part({"type": "reasoning-start", "id": item["id"]})
                            elif kind == "function_call":
                                yield part({"type": "tool-input-start", "toolCallId": item.get("call_id", item["id"]), "toolName": item.get("name", "unknown")})
                        elif typ == "response.output_text.delta":
                            yield part({"type": "text-delta", "id": event.get("item_id"), "delta": event["delta"]})
                        elif typ == "response.reasoning_summary_text.delta":
                            yield part({"type": "reasoning-delta", "id": event.get("item_id"), "delta": event["delta"]})
                        elif typ == "response.function_call_arguments.delta":
                            yield part({"type": "tool-input-delta", "toolCallId": event["call_id"], "inputTextDelta": event["delta"]})
                        elif typ == "response.output_item.done":
                            item = event.get("item", {})
                            kind = item.get("type")
                            if kind == "function_call":
                                try:
                                    args = json.loads(item.get("arguments", "{}"))
                                except json.JSONDecodeError:
                                    args = item.get("arguments", "")
                                yield part({"type": "tool-input-available", "toolCallId": item["call_id"], "toolName": item["name"], "input": args})
                            elif kind == "function_call_output":
                                yield part({"type": "tool-output-available", "toolCallId": item["call_id"], "output": item.get("output")})
                            elif kind == "reasoning":
                                yield part({"type": "reasoning-end", "id": item["id"]})
                            elif kind == "message":
                                yield part({"type": "text-end", "id": item["id"]})
                        elif typ == "response.completed":
                            yield part({"type": "finish"})
                    yield b"data: [DONE]\n\n"
        except asyncio.CancelledError:
            raise
        except Exception as e:
            yield part({"type": "error", "errorText": str(e)})
            yield part({"type": "finish"})
            yield b"data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"x-vercel-ai-ui-message-stream": "v1", "cache-control": "no-cache"})
