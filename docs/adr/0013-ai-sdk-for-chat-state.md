---
status: accepted
---

# Vercel AI SDK for chat state

The frontend uses the AI SDK's chat hook, because shadcn/ui's chat components are built around its message parts, and assistant-ui was dropped to avoid two libraries owning the conversation. This depends on spike S1 showing that the Python backend can relay Hermes's stream in the format the hook expects. If S1 fails, this is superseded by assistant-ui with the same components.
