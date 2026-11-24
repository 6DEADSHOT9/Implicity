#!/bin/sh
set -eu
if [ -z "${HERMES_API_KEY:-}" ]; then
  HERMES_API_KEY=$(sed -n 's/^API_SERVER_KEY=//p' "$HOME/.hermes/.env" | tail -n 1)
  export HERMES_API_KEY
fi
: "${HERMES_API_KEY:?Set HERMES_API_KEY or configure API_SERVER_KEY in ~/.hermes/.env}"
python3 -m venv .venv
.venv/bin/pip install -q -r requirements.txt
npm install
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8821 &
relay_pid=$!
trap 'kill "$relay_pid" 2>/dev/null || true' EXIT INT TERM
npm run dev -- --host 127.0.0.1
