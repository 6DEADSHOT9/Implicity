import json
import re
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).parent
last_headers = {}


def config():
    values = {}
    for line in (ROOT / ".env").read_text().splitlines():
        if line and not line.startswith("#"):
            key, value = line.split("=", 1)
            values[key] = value
    return values


def request(path, payload=None, project_key=False, method=None):
    global last_headers
    cfg = config()
    headers = {"Content-Type": "application/json"}
    if not project_key:
        headers["Authorization"] = f"Bearer {cfg['POSTHOG_PERSONAL_KEY']}"
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        cfg["POSTHOG_HOST"].rstrip("/") + path, data=data, headers=headers,
        method=method or ("POST" if payload is not None else "GET"),
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            last_headers = dict(response.headers)
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        last_headers = dict(error.headers)
        return error.code, error.read().decode(errors="replace")


def project_id():
    return config()["POSTHOG_PROJECT_ID"]


def sample_ram(writer, phase):
    result = subprocess.run(
        ["docker", "stats", "--no-stream", "--format", "{{.Name}},{{.MemUsage}}"],
        capture_output=True, text=True, check=True, timeout=15,
    )
    total = 0
    for line in result.stdout.splitlines():
        name, usage = line.split(",", 1)
        if name.startswith("s2-s3-posthog-"):
            amount, unit = re.fullmatch(r"([\d.]+)([KMGT]iB)", usage.split(" / ", 1)[0]).groups()
            total += int(float(amount) * {"KiB": 1024, "MiB": 1024**2, "GiB": 1024**3, "TiB": 1024**4}[unit])
    writer.writerow([time.time(), phase, total])
