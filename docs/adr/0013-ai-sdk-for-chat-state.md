---
status: accepted
---

# Vercel AI SDK for chat state

The frontend uses the AI SDK's chat hook, because shadcn/ui's chat components are built around its message parts, and assistant-ui was dropped to avoid two libraries owning the conversation. This depends on spike S1 showing that the Python backend can relay Hermes's stream in the format the hook expects. If S1 fails, this is superseded by assistant-ui with the same components.

## Outcome of S1

S1 failed on one criterion only: closing the stream did not stop the Hermes turn. The relay itself passed: text, reasoning, and tool calls with their results all rendered as distinct AI SDK parts. Cancel failing is Hermes's behaviour on disconnect, which assistant-ui would inherit unchanged, so the fallback was not taken and this decision is accepted. How the cancel gap is handled is recorded in ADR 0019.
