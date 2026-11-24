import csv
import json
import atexit
import subprocess
import sys
import time
import uuid
from datetime import date, timedelta

import common
from common import ROOT, config, project_id, request


pid = project_id()
name = "spike_daily_event_counts"
base = f"/api/environments/{pid}/endpoints/"
run_path = f"/api/environments/{pid}/endpoints/{name}/run/"
query = {
    "kind": "HogQLQuery",
    "query": "SELECT toDate(timestamp) AS day, properties['kind'] AS kind, count() AS count "
             "FROM events WHERE event = 'spike_query_event' AND timestamp >= now() - INTERVAL 30 DAY "
             "GROUP BY day, kind ORDER BY day, kind",
}


def call(route, payload, method=None):
    started = time.perf_counter()
    status, body = request(route, payload, method=method)
    return status, body, (time.perf_counter() - started) * 1000


def require(status, body, step, method, path, payload, expected=(200, 201)):
    if status not in expected:
        (ROOT / "s3-setup.json").write_text(json.dumps({
            "result": "fail", "step": step,
            "api_call": {"method": method, "path": path, "payload": payload},
            "status": status, "response": body,
        }, indent=2) + "\n")
        raise RuntimeError(f"HTTP {status}: {body}")


cfg = config()
event_payload = {
    "api_key": cfg["POSTHOG_PROJECT_KEY"],
    "batch": [{
        "event": "spike_query_event",
        "distinct_id": "s3-placeholder",
        "properties": {"kind": "placeholder"},
    }],
}
status, body = request("/batch/", event_payload, project_key=True)
if status not in (200, 201):
    raise RuntimeError(f"seed event HTTP {status}: {body}")

create_status, created, create_ms = call(base, {
    "name": name, "description": "S3 placeholder query", "query": query, "is_materialized": False,
})
create_payload = {"name": name, "description": "S3 placeholder query", "query": query, "is_materialized": False}
require(create_status, created, "create endpoint", "POST", base, create_payload, (201,))

regular_status, regular, regular_ms = call(f"/api/projects/{pid}/query/", {"query": query})
require(regular_status, regular, "initial regular query", "POST", f"/api/projects/{pid}/query/", {"query": query})
endpoint_status, endpoint, endpoint_ms = call(run_path, {})
require(endpoint_status, endpoint, "initial endpoint run", "POST", run_path, {})
comparable = endpoint.get("results") == regular.get("results")

first_version = created["current_version"]
start_date = (date.today() - timedelta(days=30)).isoformat()
variable_name = f"S3 Date From {uuid.uuid4().hex[:8]}"
variable_create_status, variable, variable_ms = call(
    f"/api/environments/{pid}/insight_variables/",
    {"name": variable_name, "type": "String", "default_value": start_date},
)
variable_payload = {"name": variable_name, "type": "String", "default_value": start_date}
require(variable_create_status, variable, "create date variable", "POST", f"/api/environments/{pid}/insight_variables/", variable_payload, (201,))
variable_query = {
    **query,
    "query": "SELECT toDate(timestamp) AS day, properties['kind'] AS kind, count() AS count "
             f"FROM events WHERE event = 'spike_query_event' AND timestamp >= toDateTime({{variables.{variable['code_name']}}}) "
             "GROUP BY day, kind ORDER BY day, kind",
    "variables": {
        variable["id"]: {"variableId": variable["id"], "code_name": variable["code_name"], "value": start_date},
    },
}
update_status, updated, update_ms = call(base + name + "/", {"query": variable_query}, "PATCH")
require(update_status, updated, "update endpoint query", "PATCH", base + name + "/", {"query": variable_query})
new_version = updated.get("current_version")
variable_run_status, variable_result, variable_run_ms = call(run_path, {"variables": {variable["code_name"]: start_date}})
require(variable_run_status, variable_result, "run endpoint with date variable", "POST", run_path, {"variables": {variable["code_name"]: start_date}})
version_read_status, version_read, version_read_ms = call(base + name + "/", None)
require(version_read_status, version_read, "read endpoint version", "GET", base + name + "/", None)
version_served = version_read.get("current_version") == new_version and new_version != first_version

with (ROOT / "s3-timings.csv").open("w", newline="") as raw, (ROOT / "ram.csv").open("a", newline="") as ram:
    rows = csv.writer(raw)
    if ram.tell() == 0:
        csv.writer(ram).writerow(["unix_time", "phase", "stack_bytes"])
        ram.flush()
    sampler = subprocess.Popen([sys.executable, str(ROOT / "ram_sampler.py"), "s3"])
    atexit.register(sampler.terminate)
    rows.writerow(["route", "trial", "status", "response_ms", "rate_limit_remaining", "retry_after"])
    for route_name, path, payload in (
        ("regular_query", f"/api/projects/{pid}/query/", {"query": query}),
        ("endpoint_run", run_path, {"variables": {variable["code_name"]: start_date}}),
    ):
        for trial in range(1, 101):
            status, body, elapsed = call(path, payload)
            rows.writerow([route_name, trial, status, round(elapsed, 2),
                           common.last_headers.get("X-RateLimit-Remaining", ""),
                           common.last_headers.get("Retry-After", "")])
            if status >= 500:
                print(f"{route_name} trial {trial}: HTTP {status}")
    raw.flush()

(ROOT / "s3-setup.json").write_text(json.dumps({
    "result": "pass" if comparable and version_served and variable_run_status == 200 else "fail",
    "api_calls": [
        {"method": "POST", "path": base, "payload": create_payload},
        {"method": "POST", "path": run_path, "payload": {}},
        {"method": "POST", "path": f"/api/projects/{pid}/query/", "payload": {"query": query}},
        {"method": "POST", "path": f"/api/environments/{pid}/insight_variables/", "payload": variable_payload},
        {"method": "PATCH", "path": base + name + "/", "payload": {"query": variable_query}},
        {"method": "POST", "path": run_path, "payload": {"variables": {variable["code_name"]: start_date}}},
        {"method": "GET", "path": base + name + "/"},
    ],
    "create": {"status": create_status, "ms": round(create_ms, 2)},
    "first_run": {"status": endpoint_status, "ms": round(endpoint_ms, 2)},
    "regular_query": {"status": regular_status, "ms": round(regular_ms, 2)},
    "results_match": comparable,
    "update": {"status": update_status, "ms": round(update_ms, 2)},
    "first_version": first_version,
    "new_version": new_version,
    "version_served": version_served,
    "variable_run": {"status": variable_run_status, "ms": round(variable_run_ms, 2)},
    "version_read_ms": round(version_read_ms, 2),
    "variable_create": {"status": variable_create_status, "ms": round(variable_ms, 2), "id": variable["id"], "code_name": variable["code_name"]},
}, indent=2) + "\n")
print(f"created={create_status}; results_match={comparable}; version_served={version_served}; variable_run={variable_run_status}")
