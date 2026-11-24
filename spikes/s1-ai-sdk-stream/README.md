# PROTOTYPE: S1 AI SDK stream relay

Throwaway spike. Hermes must be signed in to Codex, and its gateway must be running with the authenticated API server enabled. The relay reads `API_SERVER_KEY` from `~/.hermes/.env`, or from `HERMES_API_KEY` in the environment.

Run from the repository root:

```sh
cd spikes/s1-ai-sdk-stream && ./run.sh
```

Open the Vite URL printed by the command. The current relay creates one Hermes session per browser page and sends turns to `/api/sessions/{session_id}/chat/stream`; the case selector names raw SSE captures in `captures/`. Cancel closes the browser and relay streams, but Hermes completed the observed session turn 88.2 seconds after the click. This prototype is not production code.
