import json
import os
import platform
import re
import secrets
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SECRET_BYTES = {
    "HERMES_API_KEY": 32,
    "POSTHOG_DB_PASSWORD": 32,
    "POSTHOG_CH_PASSWORD": 32,
    "POSTHOG_SECRET": 32,
    "POSTHOG_ENCRYPTION_SALT_KEYS": 16,
}


def memory_sufficient(total_bytes: int) -> bool:
    return total_bytes >= 16 * 1024**3


def total_memory() -> int:
    if platform.system() == "Darwin":
        return int(subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True))
    for line in Path("/proc/meminfo").read_text().splitlines():
        if line.startswith("MemTotal:"):
            return int(line.split()[1]) * 1024
    return os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES")


def _env_lines(path: Path) -> tuple[list[str], dict[str, str]]:
    lines = path.read_text().splitlines() if path.exists() else []
    values = {}
    for line in lines:
        key, separator, value = line.partition("=")
        if separator and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            values[key] = value
    return lines, values


def _write_env(path: Path, lines: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(dir=path.parent, prefix=".env-")
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w") as stream:
            stream.write("\n".join(lines) + "\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def set_env_value(path: Path, key: str, value: str) -> None:
    lines, values = _env_lines(path)
    if key in values:
        lines = [
            f"{key}={value}" if line.startswith(f"{key}=") else line for line in lines
        ]
    else:
        lines.append(f"{key}={value}")
    _write_env(path, lines)


def ensure_env(
    path: Path,
    example: Path,
    token_hex=secrets.token_hex,
) -> dict[str, str]:
    existed = path.exists()
    lines, values = _env_lines(path)
    template = example.read_text().splitlines()
    for line in template:
        key, separator, value = line.partition("=")
        if not separator or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            if not path.exists():
                lines.append(line)
            continue
        if key not in values:
            generated = value
            if key in SECRET_BYTES:
                generated = token_hex(SECRET_BYTES[key])
            elif value.startswith("replace-with-"):
                generated = token_hex(32)
            lines.append(f"{key}={generated}")
            values[key] = generated
        elif values[key].startswith("replace-with-") and key in SECRET_BYTES:
            value = token_hex(SECRET_BYTES[key])
            lines = [
                f"{key}={value}" if item.startswith(f"{key}=") else item
                for item in lines
            ]
            values[key] = value
    if not existed or lines != path.read_text().splitlines():
        _write_env(path, lines)
    else:
        os.chmod(path, 0o600)
    return values


class PostHog:
    def __init__(self, base_url: str, personal_key: str):
        self.base_url = base_url.rstrip("/")
        self.personal_key = personal_key

    def request(self, method: str, path: str, body=None):
        data = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(
            self.base_url + path,
            data=data,
            method=method,
            headers={
                "Authorization": f"Bearer {self.personal_key}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
            raise RuntimeError(
                f"PostHog API {method} {path} returned HTTP {error.code}"
            ) from error

    def list_projects(self):
        page = "/api/projects/"
        results = []
        while page:
            response = self.request("GET", page)
            results.extend(response.get("results", []))
            page = response.get("next") or ""
            if page.startswith(self.base_url):
                page = page[len(self.base_url) :]
        return results

    def create_project(self, name: str):
        return self.request("POST", "/api/projects/", {"name": name})

    def get_endpoint(self, project_id: int, name: str):
        return self.request("GET", f"/api/environments/{project_id}/endpoints/{name}/")

    def create_endpoint(self, project_id: int, name: str, query: str):
        return self.request(
            "POST",
            f"/api/environments/{project_id}/endpoints/",
            {"name": name, "query": query},
        )

    def update_endpoint(self, project_id: int, name: str, query: str):
        return self.request(
            "PATCH",
            f"/api/environments/{project_id}/endpoints/{name}/",
            {"query": query},
        )


def ensure_project(client, name: str) -> tuple[dict, bool]:
    existing = next(
        (item for item in client.list_projects() if item["name"] == name), None
    )
    return (existing, False) if existing else (client.create_project(name), True)


def ensure_feature(client, project_id: int, name: str, query: str) -> bool:
    existing = client.get_endpoint(project_id, name)
    if existing is None:
        client.create_endpoint(project_id, name, query)
        return True
    if existing.get("query") == query:
        return False
    client.update_endpoint(project_id, name, query)
    return True


def _identifier(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", value):
        raise ValueError(f"invalid Feature identifier: {value}")
    return value


def _literal(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'") + "'"


def _where_clause(where: dict) -> str:
    return (
        " AND ".join(
            f"properties.{_identifier(key)} = {_literal(value)}"
            for key, value in sorted(where.items())
        )
        or "1"
    )


def feature_query(feature: dict) -> str:
    _identifier(feature["id"])
    happened = feature.get("happened")
    chance = feature["could_have"]
    chance_event = _literal(chance["event"])
    chance_where = _where_clause(chance.get("where", {}))
    happened_clause = "0"
    if happened:
        happened_event = _literal(happened["event"])
        happened_where = _where_clause(happened.get("where", {}))
        happened_clause = f"countIf(event = {happened_event} AND ({happened_where}))"
    return (
        "SELECT toDate(timestamp) AS day, properties.kind AS kind, "
        "groupUniqArrayIf(properties.conversation_id, "
        f"event = {chance_event} AND ({chance_where})) AS conversation_ids, "
        f"{happened_clause} AS happened, "
        f"countIf(event = {chance_event} AND ({chance_where})) AS could_have "
        "FROM events WHERE event IN ("
        + ", ".join(
            _literal(condition["event"])
            for condition in ([happened] if happened else []) + [chance]
        )
        + ") GROUP BY day, kind ORDER BY day, kind"
    )


def load_features(directory: Path) -> list[dict]:
    import yaml

    return [
        yaml.safe_load(path.read_text()) for path in sorted(directory.glob("*.yaml"))
    ]


def _run(args: list[str], *, capture=False) -> subprocess.CompletedProcess:
    return subprocess.run(args, check=True, text=True, capture_output=capture)


def _healthy_stack() -> bool:
    expected = json.loads(
        _run(
            [
                "docker",
                "compose",
                "--profile",
                "development",
                "config",
                "--format",
                "json",
            ],
            capture=True,
        ).stdout
    )["services"]
    result = _run(
        ["docker", "compose", "--profile", "development", "ps", "--format", "json"],
        capture=True,
    )
    rows = [json.loads(line) for line in result.stdout.splitlines() if line.strip()]
    return len(rows) == len(expected) and all(
        row.get("State") == "running" and row.get("Health") == "healthy" for row in rows
    )


def _container_ids() -> tuple[str, ...]:
    result = _run(
        ["docker", "compose", "--profile", "development", "ps", "-q"],
        capture=True,
    )
    return tuple(sorted(result.stdout.splitlines()))


def _codex_signed_in() -> bool:
    result = _run(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            "hermes",
            "hermes",
            "auth",
            "status",
            "openai-codex",
        ],
        capture=True,
    )
    return hermes_codex_signed_in(result.stdout + result.stderr)


def hermes_codex_signed_in(status: str) -> bool:
    status = status.lower()
    return not any(
        text in status
        for text in (
            "no credential",
            "no codex credentials",
            "not configured",
            "not signed in",
            "logged out",
            "unauthenticated",
            "expired",
            "re-auth",
        )
    )


def open_posthog_if_interactive(url: str) -> bool:
    if (
        sys.stdin.isatty()
        and sys.stdout.isatty()
        and os.getenv("IMPLICITY_SETUP_NO_BROWSER") != "1"
        and os.getenv("CI") != "1"
    ):
        return webbrowser.open(url)
    return False


def main() -> int:
    if not memory_sufficient(total_memory()):
        print(
            "Setup requires at least 16 GB of RAM; this machine has less.",
            file=sys.stderr,
        )
        return 1
    print("Memory: OK (at least 16 GB)")

    env_path = ROOT / ".env"
    env_existed = env_path.exists()
    old_env = env_path.read_text() if env_existed else ""
    values = ensure_env(env_path, ROOT / ".env.example")
    env_changed = not env_existed or old_env != env_path.read_text()
    print(
        "Environment: created"
        if not env_existed
        else "Environment: updated"
        if env_changed
        else "Environment: already complete (skipped)"
    )
    stack_was_healthy = _healthy_stack()
    previous_containers = _container_ids()
    _run(["make", "up-development"])
    unchanged_stack = stack_was_healthy and previous_containers == _container_ids()
    print(
        "Compose: already healthy (no changes)"
        if unchanged_stack
        else "Compose: started or updated; healthy"
    )

    posthog_port = os.environ.get("POSTHOG_PORT", values.get("POSTHOG_PORT", "18000"))
    posthog_url = f"http://127.0.0.1:{posthog_port}"
    personal_key = values.get("POSTHOG_PERSONAL_API_KEY", "")
    if not personal_key:
        print(
            f"PostHog needs one-time setup at {posthog_url}: create your account and "
            "an Implicity project, then create a personal API key with project:read, "
            "project:write, endpoint:read and endpoint:write scopes."
        )
        open_posthog_if_interactive(posthog_url)
        print(
            "Save the key as POSTHOG_PERSONAL_API_KEY in .env, then "
            "run make setup again."
        )
        return 2

    client = PostHog(posthog_url, personal_key)
    project, project_created = ensure_project(client, "Implicity")
    project_id = int(project["id"])
    print(f"PostHog project: {'created' if project_created else 'found (skipped)'}")
    project_id_changed = values.get("POSTHOG_PROJECT_ID") != str(project_id)
    if project_id_changed:
        set_env_value(env_path, "POSTHOG_PROJECT_ID", str(project_id))
    print(
        "PostHog project id: stored"
        if project_id_changed
        else "PostHog project id: already present (skipped)"
    )
    project_key = project.get("api_token")
    if not project_key:
        raise RuntimeError("PostHog returned a project without an API key")
    project_key_changed = values.get("VITE_POSTHOG_API_KEY") != project_key
    if project_key_changed:
        set_env_value(env_path, "VITE_POSTHOG_API_KEY", project_key)
        values["VITE_POSTHOG_API_KEY"] = project_key
        _run(
            [
                "docker",
                "compose",
                "--profile",
                "development",
                "up",
                "-d",
                "--no-deps",
                "web-development",
            ]
        )
    print(
        "PostHog project key: stored"
        if project_key_changed
        else "PostHog project key: already present (skipped)"
    )

    features = load_features(ROOT / "contracts" / "features")
    changed = sum(
        ensure_feature(client, project_id, item["id"], feature_query(item))
        for item in features
    )
    print(
        f"Feature queries: {changed} created or updated, "
        f"{len(features) - changed} unchanged"
        if features
        else "Feature queries: skipped (no Feature definitions yet)"
    )

    _run(
        [
            "docker",
            "compose",
            "exec",
            "-T",
            "api-development",
            "uv",
            "run",
            "--locked",
            "alembic",
            "-c",
            "api/alembic.ini",
            "upgrade",
            "head",
        ],
        capture=True,
    )
    print("Alembic: at head")
    if not _codex_signed_in():
        print(
            "Hermes Codex sign-in is required. Inside the Hermes container run "
            "`hermes auth add openai-codex`, finish sign-in, then "
            "run `make setup` again."
        )
        return 2
    print("Hermes Codex sign-in: present")
    return 0


def memory_check() -> int:
    if not memory_sufficient(total_memory()):
        print(
            "Setup requires at least 16 GB of RAM; this machine has less.",
            file=sys.stderr,
        )
        return 1
    print("Memory: OK (at least 16 GB)")
    return 0


if __name__ == "__main__":
    if sys.argv[1:] == ["--check-memory"]:
        raise SystemExit(memory_check())
    raise SystemExit(main())
