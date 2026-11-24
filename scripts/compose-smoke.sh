#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
test -f .env || { echo "Copy .env.example to .env and set its five secrets first" >&2; exit 1; }

project="implicity-smoke-6deadshot9"
fault_project="${project}-fault-${RANDOM}"
override=$(mktemp)
worker_override=$(mktemp)
bootstrap=$(mktemp)
cleanup() {
  result=$?
  if [ "$result" -ne 0 ]; then
    COMPOSE_PROJECT_NAME="$project" docker compose --profile development logs --tail=50 >&2 || true
  fi
  COMPOSE_PROJECT_NAME="$project" docker compose --profile development --profile production down --remove-orphans >/dev/null 2>&1 || true
  if [ "$result" -eq 0 ]; then
    COMPOSE_PROJECT_NAME="$project" docker compose --profile development --profile production down --volumes --remove-orphans >/dev/null 2>&1 || true
  fi
  COMPOSE_PROJECT_NAME="$fault_project" docker compose --profile development -f compose.yaml -f "$override" down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -f "$override" "$worker_override" "$bootstrap"
}
trap cleanup EXIT

docker compose --profile development config --format json | python3 -c '
import json, sys
config = json.load(sys.stdin)
images = [service.get("image", "") for service in config["services"].values()]
pin = "posthog/posthog:be0a6f2a4cb4f9614a7954e01032ca3223bfdbaf"
assert sum(image == pin for image in images) == 2, images
assert any(image.startswith("ghcr.io/posthog/posthog/capture:") and "@sha256:" in image for image in images), images
assert any(image.startswith("ghcr.io/posthog/posthog-node:") and "@sha256:" in image for image in images), images
assert all(config["services"][name]["environment"].get(key) for name, key in [("hermes", "API_SERVER_KEY"), ("posthog-db", "POSTGRES_PASSWORD"), ("posthog", "SECRET_KEY"), ("posthog-clickhouse", "CLICKHOUSE_PASSWORD"), ("posthog-ingestion-general", "ENCRYPTION_SALT_KEYS")])
print("Compose pins and required secrets: PASS")
'

cat >"$override" <<'YAML'
services:
  web-development:
    healthcheck:
      test: [CMD, "false"]
YAML
if COMPOSE_PROJECT_NAME="$fault_project" docker compose --profile development -f compose.yaml -f "$override" up --build -d --wait --wait-timeout 20 web-development; then
  echo "unhealthy leaf unexpectedly passed Compose --wait" >&2
  exit 1
fi
echo "Unhealthy leaf rejected by Compose --wait: PASS"

COMPOSE_PROJECT_NAME="$project" make up-development
posthog_port=$(COMPOSE_PROJECT_NAME="$project" docker compose port posthog-proxy 8000 | sed 's/.*://')
COMPOSE_PROJECT_NAME="$project" docker compose --profile development ps --format json | python3 -c '
import json, sys
services = [json.loads(line) for line in sys.stdin if line.strip()]
assert services and all("healthy" in service["Status"] for service in services), services
print(f"Development services healthy: {len(services)}/{len(services)}")
'
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
YAML
if COMPOSE_PROJECT_NAME="$project" docker compose --profile development -f compose.yaml -f "$worker_override" up -d --no-deps --force-recreate --wait --wait-timeout 30 posthog-worker; then
  echo "worker with an unreachable Celery broker unexpectedly passed its health check" >&2
  exit 1
fi
echo "Celery worker probe rejects an unreachable broker: PASS"
COMPOSE_PROJECT_NAME="$project" docker compose --profile development up -d --wait --wait-timeout 120 posthog-worker

curl -fsSL "http://127.0.0.1:${posthog_port}/" -o /dev/null
echo "Published PostHog UI request: HTTP 200"

cat >"$bootstrap" <<'PY'
import json
from posthog.models import User
from posthog.models.personal_api_key import PersonalAPIKey
from posthog.models.utils import generate_random_token_personal, hash_key_value, mask_key_value

_, team, user = User.objects.bootstrap(
    organization_name="Compose smoke",
    email="compose-smoke@example.invalid",
    password="compose-smoke-password-123",
    first_name="Compose smoke",
    is_staff=True,
)
key = generate_random_token_personal()
PersonalAPIKey.objects.create(
    user=user,
    team=team,
    label="Compose smoke query",
    scopes=["query:read"],
    secure_value=hash_key_value(key),
    mask_value=mask_key_value(key),
)
print("SMOKE_CREDENTIALS=" + json.dumps({"query_key": key, "project_token": team.api_token, "team_id": team.id}))
PY
credentials=$(COMPOSE_PROJECT_NAME="$project" docker compose exec -T posthog python manage.py shell <"$bootstrap" | sed -n 's/^SMOKE_CREDENTIALS=//p' | tail -n 1)
test -n "$credentials"
POSTHOG_PORT="$posthog_port" SMOKE_CREDENTIALS="$credentials" python3 - <<'PY'
import json, os, time, urllib.error, urllib.request

base = f"http://127.0.0.1:{os.environ['POSTHOG_PORT']}"
credentials = json.loads(os.environ["SMOKE_CREDENTIALS"])
event = "implicity_compose_smoke"
distinct_id = "compose-smoke-" + str(time.time_ns())
payload = json.dumps({"api_key": credentials["project_token"], "event": event, "distinct_id": distinct_id, "properties": {"source": "compose-smoke"}}).encode()
request = urllib.request.Request(base + "/i/v0/e/", data=payload, headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(request, timeout=15) as response:
    assert response.status == 200, response.status
query = json.dumps({"query": {"kind": "HogQLQuery", "query": f"SELECT event FROM events WHERE distinct_id = '{distinct_id}' LIMIT 1"}}).encode()
for _ in range(60):
    request = urllib.request.Request(
        f"{base}/api/projects/{credentials['team_id']}/query/",
        data=query,
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + credentials["query_key"]},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            result = json.load(response)
        if any(row.get("event") == event for row in result.get("results", [])):
            print("SDK-shaped capture to PostHog query API: PASS")
            break
    except urllib.error.HTTPError:
        raise
    time.sleep(2)
else:
    raise SystemExit("captured event did not reach the query API within 120 seconds")
PY

node="/implicity-compose-smoke"
COMPOSE_PROJECT_NAME="$project" docker compose exec -T posthog-zookeeper sh -c "printf 'create $node persistent\nquit\n' | zkCli.sh" >/dev/null
COMPOSE_PROJECT_NAME="$project" make down
COMPOSE_PROJECT_NAME="$project" make up-development
COMPOSE_PROJECT_NAME="$project" docker compose exec -T posthog-zookeeper sh -c "printf 'get $node\nquit\n' | zkCli.sh" | grep -q persistent
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

COMPOSE_PROJECT_NAME="$project" make down
COMPOSE_PROJECT_NAME="$project" make up-production
COMPOSE_PROJECT_NAME="$project" docker compose --profile production ps --format json | python3 -c '
import json, sys
services = [json.loads(line) for line in sys.stdin if line.strip()]
assert services and all("healthy" in service["Status"] for service in services), services
print(f"Production services healthy: {len(services)}/{len(services)}")
'
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
