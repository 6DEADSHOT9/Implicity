# S1: Relay Hermes's stream to the AI SDK chat hook from Python

**Type:** spike. **Time box:** half a day. **Blocks:** T1 and everything after it.

## Question

Can a Python (FastAPI) backend relay a Hermes conversation to the browser in the
stream format that the Vercel AI SDK's chat hook expects, including text, reasoning
and tool calls?

## Why it matters

The shadcn/ui chat components (Message, Trace, Tool, Reasoning, Sources) are built
around the AI SDK's message parts. If the stream works from Python, the frontend
uses the AI SDK hook for chat state. If not, we fall back to assistant-ui.

## Do

1. Run Hermes locally with its HTTP API server enabled and Codex signed in.
2. Write a throwaway FastAPI endpoint that sends one user message to Hermes and
   streams the reply back.
3. Translate Hermes's stream into the AI SDK's stream protocol. Read the current
   protocol documentation first; do not rely on memory.
4. Write a throwaway React page (Vite) using the AI SDK chat hook against that endpoint.
5. Test four cases: plain text, a long streamed answer, a reply with reasoning,
   and a reply with at least one tool call and its result.
6. Test cancel: stopping mid-stream from the browser stops Hermes.

## Pass

All four cases render correctly as distinct message parts, and cancel works.

## Deliver

`docs/spikes/findings/S1.md` with: pass or fail, what Hermes's stream contains,
the mapping to AI SDK parts, anything lossy or awkward, and library versions used.

## If it fails

Record exactly what did not map. The fallback is assistant-ui for chat state with
the same shadcn/ui components. Do not attempt the fallback inside this spike.

## Out of bounds

No production code. No repository scaffold. Everything written here is thrown
away or rewritten under T15 and T16.
