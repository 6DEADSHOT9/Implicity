---
status: accepted
---

# Chat relays Hermes's Responses stream, and cancel stops only the display until Hermes fixes disconnect

The agent module relays Hermes's `/v1/responses` stream to the AI SDK chat hook, because it is the only Hermes route that carries text, reasoning and structured tool calls and results together (spike S1). Its cost is cancel: in Hermes 0.22.5 closing that stream does not stop the turn, so cancel ends the relay and the browser's stream while Hermes finishes the turn in the background and spends quota. We accept that for now and report the disconnect bug upstream. When Hermes stops a Responses turn on disconnect, or offers a cancel call for it, the agent module switches to it with no change to the frontend.

## Considered options

- **Runs with its stop endpoint, or the session stream.** Cancel works through Runs, and sessions keep context, but neither sends reasoning. Rejected because reasoning is part of the answer the person sees.
- **Chat Completions.** Cancel and reasoning work, but tool calls arrive only as progress events, not structured inputs and outputs. Rejected.
- **assistant-ui instead of the AI SDK** (the S1 fallback in ADR 0013). Rejected: every failure was on the Hermes side, and the AI SDK rendered all parts correctly.

## Consequences

- ADR 0013 stands: the AI SDK owns chat state.
- A cancelled turn still counts against the Codex quota, so the quota shown to the person can drop after a cancel.
- The agent module keeps the route behind its own interface, so switching routes stays local to it.
