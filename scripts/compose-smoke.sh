#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
test -f .env || { echo "Copy .env.example to .env and set its five secrets first" >&2; exit 1; }

requested_project=${COMPOSE_PROJECT_NAME:-implicity-smoke}
project="${requested_project}-$$-$(python3 -c 'import secrets; print(secrets.token_hex(4))')"
fault_project="${project}-fault"
assert_project_available() {
  candidate=$1
  containers=$(COMPOSE_PROJECT_NAME="$candidate" docker compose --profile development --profile production ps -a -q)
  volumes=$(docker volume ls --quiet --filter "label=com.docker.compose.project=$candidate")
  networks=$(docker network ls --quiet --filter "label=com.docker.compose.project=$candidate")
  if [ -n "$containers$volumes$networks" ]; then
    echo "refusing to use existing Compose project: $candidate" >&2
    exit 1
  fi
}
assert_project_available "$project"
assert_project_available "$fault_project"
override=$(mktemp)
worker_override=$(mktemp)
absent_worker_override=$(mktemp)
bootstrap=$(mktemp)
config_output=$(mktemp)
ps_output=$(mktemp)
fault_created=0
project_created=0
cleanup() {
  result=$?
  if [ "$result" -ne 0 ] && [ "$project_created" -eq 1 ]; then
    COMPOSE_PROJECT_NAME="$project" docker compose --profile development logs --tail=50 >&2 || true
    worker_id=$(COMPOSE_PROJECT_NAME="$project" docker compose --profile development ps -q posthog-worker || true)
    if [ -n "$worker_id" ]; then docker inspect -f '{{json .State.Health}}' "$worker_id" >&2 || true; fi
  fi
  if [ "$project_created" -eq 1 ]; then
    COMPOSE_PROJECT_NAME="$project" docker compose --profile development --profile production down --volumes --remove-orphans >/dev/null 2>&1 || true
  fi
  if [ "$fault_created" -eq 1 ]; then
    COMPOSE_PROJECT_NAME="$fault_project" docker compose --profile development -f compose.yaml -f "$override" down --volumes --remove-orphans >/dev/null 2>&1 || true
  fi
  rm -f "$override" "$worker_override" "$absent_worker_override" "$bootstrap" "$config_output" "$ps_output"
}
trap cleanup EXIT
export COMPOSE_PROJECT_NAME="$project"

check_profile_health() {
  profile=$1
  docker compose --profile "$profile" config --format json >"$config_output"
  docker compose --profile "$profile" ps -a --format json >"$ps_output"
  python3 - "$profile" "$config_output" "$ps_output" <<'PY'
import json, sys
from pathlib import Path
profile, config_path, ps_path = sys.argv[1:]
config = json.loads(Path(config_path).read_text())
expected = set(config["services"])
rows = [json.loads(line) for line in Path(ps_path).read_text().splitlines() if line]
actual = {row["Service"] for row in rows}
assert actual == expected, {"expected": sorted(expected), "actual": sorted(actual)}
assert len(rows) == len(expected)
assert all(row.get("State") == "running" and row.get("Health") == "healthy" for row in rows), rows
print(f"{profile.capitalize()} services healthy: {len(rows)}/{len(expected)}")
PY
}

check_service_health() {
  project_name=$1
  profile=$2
  service=$3
  expected_health=$4
  COMPOSE_PROJECT_NAME="$project_name" docker compose --profile "$profile" ps -a --format json | python3 -c '
import json, sys
service, expected = sys.argv[1:]
rows = [json.loads(line) for line in sys.stdin if line.strip()]
matched = [row for row in rows if row.get("Service") == service]
assert len(matched) == 1, rows
row = matched[0]
assert row.get("State") == "running" and row.get("Health") == expected, row
print(f"{service} running with health={expected}: PASS")
' "$service" "$expected_health"
}

check_api_image_imports() {
  service=$1
  image="${project}-${service}"
  docker run --rm --network none --entrypoint uv "$image" run --locked python -c 'import implicity_api, implicity_contracts, implicity_engine'
  echo "$service package imports: PASS"
}

docker compose --profile development config --format json | python3 -c '
import json, sys
config = json.load(sys.stdin)
images = [service["image"] for service in config["services"].values() if service.get("image")]
app_pin = "posthog/posthog@sha256:e83432bf0072817cf30f90bc1d05c3974a9694bc3fa2e2a27b1505be9f1ed519"
node_pin = "ghcr.io/posthog/posthog-node@sha256:fb496e55708308c9e4cd324e301d0f665c8a4b2403131481c55f2f31b897afc6"
assert sum(image == app_pin for image in images) == 2, images
assert sum(image == node_pin for image in images) == 1, images
assert any(image.startswith("ghcr.io/posthog/posthog/capture:") and "@sha256:" in image for image in images), images
assert any(volume.get("target") == "/logs" and volume.get("type") == "volume" and volume.get("source") == "posthog-zookeeper-logs" for volume in config["services"]["posthog-zookeeper"]["volumes"])
assert all(config["services"][name]["environment"].get(key) for name, key in [("hermes", "API_SERVER_KEY"), ("posthog-db", "POSTGRES_PASSWORD"), ("posthog", "SECRET_KEY"), ("posthog-clickhouse", "CLICKHOUSE_PASSWORD"), ("posthog-ingestion-general", "ENCRYPTION_SALT_KEYS")])
print("Compose pins and required secrets: PASS")
'

cat >"$override" <<'YAML'
services:
  web-development:
    healthcheck:
      test: [CMD, "false"]
YAML
fault_created=1
if COMPOSE_PROJECT_NAME="$fault_project" docker compose --profile development -f compose.yaml -f "$override" up --build -d --wait --wait-timeout 20 web-development; then
  echo "unhealthy leaf unexpectedly passed Compose --wait" >&2
  exit 1
fi
check_service_health "$fault_project" development web-development unhealthy
echo "Unhealthy leaf rejected by Compose --wait: PASS"

project_created=1
make up-development
check_api_image_imports api-development
api_id_before=$(COMPOSE_PROJECT_NAME="$project" docker compose ps -q api-development)
make up-development
api_id_after=$(COMPOSE_PROJECT_NAME="$project" docker compose ps -q api-development)
test "$api_id_before" = "$api_id_after"
echo "API container id after second setup build: stable ($api_id_after)"
posthog_port=$(docker compose port posthog-proxy 8000 | sed 's/.*://')
check_profile_health development
api_id=$(COMPOSE_PROJECT_NAME="$project" docker compose ps -q api-development)
clickhouse_id=$(COMPOSE_PROJECT_NAME="$project" docker compose ps -q posthog-clickhouse)
docker inspect "$api_id" "$clickhouse_id" | python3 -c '
import json, sys
api, clickhouse = json.load(sys.stdin)
api_networks = set(api["NetworkSettings"]["Networks"])
clickhouse_networks = set(clickhouse["NetworkSettings"]["Networks"])
assert api_networks.isdisjoint(clickhouse_networks), (api_networks, clickhouse_networks)
print("App and ClickHouse have no shared network: PASS")
'

cat >"$worker_override" <<'YAML'
services:
  posthog-worker:
    environment:
      CELERY_BROKER_URL: redis://127.0.0.1:6399/0
    healthcheck:
      start_period: 0s
YAML
if docker compose --profile development -f compose.yaml -f "$worker_override" up -d --no-deps --force-recreate --wait --wait-timeout 30 posthog-worker; then
  echo "worker with an unreachable Celery broker unexpectedly passed its health check" >&2
  exit 1
fi
check_service_health "$project" development posthog-worker unhealthy
echo "Celery worker probe rejects an unreachable broker: PASS"

cat >"$absent_worker_override" <<'YAML'
services:
  posthog-worker:
    command: [sleep, "600"]
    healthcheck:
      start_period: 0s
YAML
if docker compose --profile development -f compose.yaml -f "$absent_worker_override" up -d --no-deps --force-recreate --wait --wait-timeout 30 posthog-worker; then
  echo "worker without Celery unexpectedly passed its health check" >&2
  exit 1
fi
check_service_health "$project" development posthog-worker unhealthy
echo "Celery worker probe rejects a missing worker: PASS"
docker compose --profile development up -d --no-deps --force-recreate --wait --wait-timeout 120 posthog-worker

curl -fsSL "http://127.0.0.1:${posthog_port}/" -o /dev/null
echo "Published PostHog UI request: HTTP 200"

cat >"$bootstrap" <<'PY'
import json, time
from posthog.models import User
from posthog.models.personal_api_key import PersonalAPIKey
from posthog.models.utils import generate_random_token_personal, hash_key_value, mask_key_value

_, team, user = User.objects.bootstrap(
    organization_name="Compose smoke",
    email=f"compose-smoke-{time.time_ns()}@example.invalid",
    password="compose-smoke-password-123",
    first_name="Compose smoke",
    is_staff=True,
)
key = generate_random_token_personal()
PersonalAPIKey.objects.create(
    user=user,
    team=team,
    label="Compose smoke query",
    scopes=["query:read", "project:read", "project:write", "endpoint:read", "endpoint:write", "insight_variable:read", "insight_variable:write"],
    secure_value=hash_key_value(key),
    mask_value=mask_key_value(key),
)
print("SMOKE_CREDENTIALS=" + json.dumps({"query_key": key, "project_token": team.api_token, "team_id": team.id}))
PY
credentials=$(COMPOSE_PROJECT_NAME="$project" docker compose exec -T posthog python manage.py shell <"$bootstrap" | sed -n 's/^SMOKE_CREDENTIALS=//p' | tail -n 1)
test -n "$credentials"
POSTHOG_PORT="$posthog_port" SMOKE_CREDENTIALS="$credentials" uv run --locked python - <<'PY'
import json, os, tempfile
from pathlib import Path
from implicity_api.modules.event_source.posthog import PostHog, register_features

credentials = json.loads(os.environ["SMOKE_CREDENTIALS"])
with tempfile.TemporaryDirectory() as directory:
    features = Path(directory)
    (features / "smoke.yaml").write_text(
        "id: compose_smoke\nhappened: {event: smoke_happened}\n"
        "could_have: {event: smoke_seen}\ngroup_by: [day, kind]\n"
    )
    client = PostHog(
        f"http://127.0.0.1:{os.environ['POSTHOG_PORT']}", credentials["query_key"]
    )
    assert register_features(client, credentials["team_id"], features) == (1, 0)
    print("PostHog accepted saved HogQL query and three variable definitions: PASS")
PY
POSTHOG_PORT="$posthog_port" SMOKE_CREDENTIALS="$credentials" python3 - <<'PY'
import json, os, time, urllib.error, urllib.request

base = f"http://127.0.0.1:{os.environ['POSTHOG_PORT']}"
credentials = json.loads(os.environ["SMOKE_CREDENTIALS"])
event = "implicity_compose_smoke"
distinct_id = "compose-smoke-" + str(time.time_ns())
preflight = urllib.request.Request(base + "/e/", headers={"Origin": "http://127.0.0.1:4311", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"}, method="OPTIONS")
with urllib.request.urlopen(preflight, timeout=15) as response:
    assert response.status == 200, response.status
    assert response.headers.get("Access-Control-Allow-Origin") == "http://127.0.0.1:4311", response.headers
print("SDK /e/ cross-origin preflight: PASS")
payload = json.dumps({"token": credentials["project_token"], "event": event, "distinct_id": distinct_id, "properties": {"source": "compose-smoke"}}).encode()
request = urllib.request.Request(base + "/e/", data=payload, headers={"Content-Type": "application/json", "Origin": "http://127.0.0.1:4311"}, method="POST")
with urllib.request.urlopen(request, timeout=15) as response:
    assert response.status == 200, response.status
sent_at = time.monotonic()
for _ in range(60):
    cache_buster = time.time_ns()
    query = json.dumps({"query": {"kind": "HogQLQuery", "query": f"SELECT event FROM events WHERE distinct_id = '{distinct_id}' AND {cache_buster} > 0 LIMIT 1"}}).encode()
    request = urllib.request.Request(
        f"{base}/api/projects/{credentials['team_id']}/query/",
        data=query,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + credentials["query_key"]},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            result = json.load(response)
        if any(row and row[0] == event for row in result.get("results", [])):
            print(f"SDK-shaped capture to PostHog query API: PASS after {time.monotonic() - sent_at:.2f}s")
            break
    except urllib.error.HTTPError:
        raise
    time.sleep(2)
else:
    raise SystemExit("captured event did not reach the query API within 120 seconds")
PY

node="/implicity-compose-smoke-${RANDOM}"
docker compose exec -T posthog-zookeeper sh -c "printf 'create $node persistent\nquit\n' | zkCli.sh" >/dev/null
make down
make up-development
docker compose exec -T posthog-zookeeper sh -c "printf 'get $node\nquit\n' | zkCli.sh" | grep persistent >/dev/null
echo "ZooKeeper transaction data after make down/up: PASS"

docker stats --no-stream --format '{{.MemUsage}}' $(COMPOSE_PROJECT_NAME="$project" docker compose ps -q) | python3 -c '
import re, sys
units = {"B": 1, "KiB": 1024, "MiB": 1024**2, "GiB": 1024**3}
values = []
for line in sys.stdin:
    value = line.split(" / ", 1)[0]
    match = re.fullmatch(r"([0-9.]+)(B|KiB|MiB|GiB)", value)
    if match:
        values.append(float(match[1]) * units[match[2]])
print(f"Development memory snapshot: {sum(values) / 1024**3:.2f} GiB")
'

make down
make up-production
check_api_image_imports api-production
check_profile_health production
curl -fsSL "http://127.0.0.1:${posthog_port}/" -o /dev/null
echo "Published PostHog UI request (production profile): HTTP 200"
docker stats --no-stream --format '{{.MemUsage}}' $(COMPOSE_PROJECT_NAME="$project" docker compose ps -q) | python3 -c '
import re, sys
units = {"B": 1, "KiB": 1024, "MiB": 1024**2, "GiB": 1024**3}
values = []
for line in sys.stdin:
    match = re.fullmatch(r"([0-9.]+)(B|KiB|MiB|GiB)", line.split(" / ", 1)[0])
    if match:
        values.append(float(match[1]) * units[match[2]])
print(f"Production memory snapshot: {sum(values) / 1024**3:.2f} GiB")
'
