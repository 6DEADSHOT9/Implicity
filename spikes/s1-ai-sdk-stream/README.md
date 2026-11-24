# PROTOTYPE: S1 AI SDK stream relay

Throwaway spike. Hermes must be signed in to Codex, and its gateway must be running with the authenticated API server enabled. The relay reads `API_SERVER_KEY` from `~/.hermes/.env`, or from `HERMES_API_KEY` in the environment.

Run from the repository root:

```sh
cd spikes/s1-ai-sdk-stream && ./run.sh
```

Open the Vite URL printed by the command. Use Cancel to close the browser stream. The `/v1/responses` route tested in this spike does not stop Hermes promptly on disconnect. This prototype is not production code.
