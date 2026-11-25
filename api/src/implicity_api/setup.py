import json
import os
import platform
import re
import secrets
import subprocess
import sys
import tempfile
import webbrowser
from pathlib import Path

from implicity_api.modules.event_source.posthog import (
    PostHog,
    ensure_project,
    register_features,
)

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
        match = re.fullmatch(
            r"\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*", line
        )
        if match:
            key, value = match.groups()
            if value.startswith(("'", '"')) and value.endswith(value[0]):
                value = value[1:-1]
            else:
                value = re.sub(r"\s+#.*$", "", value).strip()
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
    if values.get(key):
        if values[key] != value:
            raise RuntimeError(
                f"{key} in .env does not match the project returned by PostHog; "
                "reconcile it and rerun setup"
            )
        return
    found = False
    for index in range(len(lines) - 1, -1, -1):
        line = lines[index]
        if re.fullmatch(rf"\s*(?:export\s+)?{re.escape(key)}\s*=.*", line):
            lines[index] = f"{key}={value}"
            found = True
            break
    if not found:
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
        if not values.get(key):
            generated = value
            if key in SECRET_BYTES:
                generated = token_hex(SECRET_BYTES[key])
            elif value.startswith("replace-with-"):
                generated = token_hex(32)
            existing = next(
                (
                    i
                    for i in range(len(lines) - 1, -1, -1)
                    if re.fullmatch(
                        rf"\s*(?:export\s+)?{re.escape(key)}\s*=.*", lines[i]
                    )
                ),
                None,
            )
            if existing is not None:
                lines[existing] = f"{key}={generated}"
            else:
                lines.append(f"{key}={generated}")
            values[key] = generated
        else:
            continue
    if not existed or lines != path.read_text().splitlines():
        _write_env(path, lines)
    else:
        os.chmod(path, 0o600)
    return values


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


def _codex_auth_status() -> str:
    result = subprocess.run(
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
        check=False,
        text=True,
        capture_output=True,
    )
    if result.returncode:
        return "unknown"
    status = result.stdout + result.stderr
    if hermes_codex_signed_in(status):
        return "signed-in"
    if re.search(r"(?im)^openai-codex:\s*logged out\b", status):
        return "logged-out"
    return "unknown"


def hermes_codex_signed_in(status: str) -> bool:
    return bool(
        re.search(r"(?im)^openai-codex:\s*(?:authenticated|logged in)\b", status)
    )


def open_posthog_if_interactive(url: str) -> bool:
    if (
        sys.stdin.isatty()
        and sys.stdout.isatty()
        and os.getenv("IMPLICITY_SETUP_NO_BROWSER") != "1"
        and os.getenv("CI", "").strip().lower() not in {"1", "true", "yes"}
    ):
        return webbrowser.open(url)
    return False


def _setup() -> int:
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

    try:
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
    except subprocess.CalledProcessError as error:
        diagnostic = (
            error.stderr or error.stdout or "Alembic migration failed"
        ).strip()
        print(diagnostic, file=sys.stderr)
        return error.returncode or 1
    print("Alembic: at head")

    posthog_port = os.environ.get("POSTHOG_PORT", values.get("POSTHOG_PORT", "18000"))
    posthog_url = f"http://127.0.0.1:{posthog_port}"
    personal_key = values.get("POSTHOG_PERSONAL_API_KEY", "")
    if not personal_key:
        print(
            f"PostHog needs one-time setup at {posthog_url}: create your account and "
            "then create a personal API key with project:read, "
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
    if values.get("POSTHOG_PROJECT_ID") and values["POSTHOG_PROJECT_ID"] != str(
        project_id
    ):
        raise RuntimeError(
            "POSTHOG_PROJECT_ID in .env does not match the project returned by "
            "PostHog; reconcile it and rerun setup"
        )
    project_id_changed = not values.get("POSTHOG_PROJECT_ID")
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
    if (
        values.get("VITE_POSTHOG_API_KEY")
        and values["VITE_POSTHOG_API_KEY"] != project_key
    ):
        raise RuntimeError(
            "VITE_POSTHOG_API_KEY in .env does not match the project returned by "
            "PostHog; reconcile it and rerun setup"
        )
    project_key_changed = not values.get("VITE_POSTHOG_API_KEY")
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
                "--wait",
                "web-development",
            ]
        )
    print(
        "PostHog project key: stored"
        if project_key_changed
        else "PostHog project key: already present (skipped)"
    )

    changed, unchanged = register_features(
        client, project_id, ROOT / "contracts" / "features"
    )
    print(
        f"Feature queries: {changed} created or updated, {unchanged} unchanged"
        if changed + unchanged
        else "Feature queries: skipped (no Feature definitions yet)"
    )

    auth_status = _codex_auth_status()
    if auth_status == "logged-out":
        print(
            "Hermes Codex sign-in is required. Inside the Hermes container run "
            "`hermes auth add openai-codex`, finish sign-in, then "
            "run `make setup` again."
        )
        return 2
    if auth_status != "signed-in":
        print(
            "Hermes Codex sign-in check failed; run "
            "`hermes auth status openai-codex` inside the Hermes container and retry.",
            file=sys.stderr,
        )
        return 1
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


def main() -> int:
    try:
        return _setup()
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    if sys.argv[1:] == ["--check-memory"]:
        raise SystemExit(memory_check())
    raise SystemExit(main())
