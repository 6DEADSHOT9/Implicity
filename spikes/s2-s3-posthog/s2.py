import csv
import json
import atexit
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone

from common import ROOT, config, project_id, request


def query(marker):
    sql = f"SELECT '{uuid.uuid4()}', count() FROM events WHERE event = 'spike_test_event' AND properties.marker = '{marker}'"
    status, body = request(f"/api/projects/{project_id()}/query/", {"query": {"kind": "HogQLQuery", "query": sql}})
    if status != 200:
        raise RuntimeError(f"query HTTP {status}: {body}")
    return int(body["results"][0][1])


with (ROOT / "s2-timings.csv").open("w", newline="") as raw, (ROOT / "ram.csv").open("a", newline="") as ram:
    rows = csv.writer(raw)
    if ram.tell() == 0:
        csv.writer(ram).writerow(["unix_time", "phase", "stack_bytes"])
        ram.flush()
    sampler = subprocess.Popen([sys.executable, str(ROOT / "ram_sampler.py"), "s2"])
    atexit.register(sampler.terminate)
    rows.writerow(["batch_size", "trial", "marker", "send_status", "send_ms", "visible_ms", "polls", "visible_count"])
    for size in (1, 100, 1000):
        for trial in range(1, 6):
            marker = str(uuid.uuid4())
            events = [{
                "event": "spike_test_event",
                "distinct_id": f"spike-{marker}-{index}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "properties": {"marker": marker, "sequence": index},
            } for index in range(size)]
            started = time.monotonic()
            status, body = request("/batch/", {"api_key": config()["POSTHOG_PROJECT_KEY"], "batch": events}, project_key=True)
            sent = time.monotonic()
            if status != 200:
                raise RuntimeError(f"batch capture HTTP {status}: {body}")
            print(f"sent size={size} trial={trial} marker={marker}", flush=True)
            polls = 0
            visible = 0
            while visible < size and time.monotonic() - sent < 600:
                polls += 1
                visible = query(marker)
                if polls == 1 or polls % 10 == 0 or visible == size:
                    print(f"poll size={size} trial={trial} count={visible}", flush=True)
                if visible < size:
                    time.sleep(1)
            rows.writerow([size, trial, marker, status, round((sent-started)*1000, 2), round((time.monotonic()-sent)*1000, 2), polls, visible])
            raw.flush()
            if visible != size:
                raise RuntimeError(f"{size} event batch {trial}: only {visible} visible after 600 seconds; {body}")
            print(f"{size} events trial {trial}: {visible} queryable after {round((time.monotonic()-sent)*1000)} ms")

numeric = {f"n{index}": index for index in range(30)}
marker = str(uuid.uuid4())
event = [{
    "event": "session_summary",
    "distinct_id": f"spike-session-{marker}",
    "timestamp": datetime.now(timezone.utc).isoformat(),
    "properties": {"marker": marker, **numeric},
}]
status, body = request("/batch/", {"api_key": config()["POSTHOG_PROJECT_KEY"], "batch": event}, project_key=True)
if status != 200:
    raise RuntimeError(f"session_summary capture HTTP {status}: {body}")
deadline = time.monotonic() + 600
while time.monotonic() < deadline:
    nonce = str(uuid.uuid4())
    status, body = request(f"/api/projects/{project_id()}/query/", {
        "query": {"kind": "HogQLQuery", "query": f"SELECT '{nonce}', properties.marker, " + ", ".join(f"properties.n{i}" for i in range(30)) +
                 " FROM events WHERE event = 'session_summary' AND properties.marker = '" + marker + "' LIMIT 1"}
    })
    if status != 200:
        raise RuntimeError(f"session summary query HTTP {status}: {body}")
    if body["results"]:
        values = body["results"][0]
        if values[:2] != [nonce, marker] or [int(value) for value in values[2:]] != list(numeric.values()):
            raise AssertionError(f"numeric properties mismatch: {values}")
        (ROOT / "s2-session-summary.json").write_text(json.dumps({"event": "session_summary", "numeric_properties": numeric, "query_values": values[2:]}, indent=2) + "\n")
        print("session_summary: all 30 numeric properties queryable")
        break
    time.sleep(1)
else:
    raise RuntimeError("session_summary not queryable within 600 seconds")
