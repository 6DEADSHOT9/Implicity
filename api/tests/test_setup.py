import json
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import Mock

import pytest
from implicity_api import setup
from implicity_api.modules.event_source.posthog import PostHog, register_features


def test_memory_requires_at_least_16_gib():
    assert setup.memory_sufficient(16 * 1024**3)
    assert not setup.memory_sufficient(16 * 1024**3 - 1)


def test_compose_export_and_spaced_assignment_are_preserved(tmp_path):
    env = tmp_path / ".env"
    example = tmp_path / ".env.example"
    env.write_text('export VITE_POSTHOG_API_KEY = "keep-me"\n')
    example.write_text("VITE_POSTHOG_API_KEY=\n")
    assert setup.ensure_env(env, example) == {"VITE_POSTHOG_API_KEY": "keep-me"}
    assert env.read_text() == 'export VITE_POSTHOG_API_KEY = "keep-me"\n'


def test_compose_dotenv_interpolation_quotes_comments_and_shell_precedence(
    tmp_path, monkeypatch
):
    env = tmp_path / ".env"
    env.write_text(
        'PREFIX=phc\nexport QUOTED = "${PREFIX}_value" # note\n'
        "SINGLE='${PREFIX}_literal' # note\nINLINE=phc_key # note\nHASH=phc#fragment\n"
    )
    _, values = setup._env_lines(env)
    assert values == {
        "PREFIX": "phc",
        "QUOTED": "phc_value",
        "SINGLE": "${PREFIX}_literal",
        "INLINE": "phc_key",
        "HASH": "phc#fragment",
    }
    monkeypatch.setenv("QUOTED", "shell-value")
    assert setup._env_lines(env)[1]["QUOTED"] == "shell-value"


def test_populated_shell_slot_is_not_written_to_dotenv(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    example = tmp_path / ".env.example"
    env.write_text("VITE_POSTHOG_API_KEY=\n")
    example.write_text("VITE_POSTHOG_API_KEY=\n")
    monkeypatch.setenv("VITE_POSTHOG_API_KEY", "phc_shell")
    setup.ensure_env(env, example)
    setup.set_env_value(env, "VITE_POSTHOG_API_KEY", "phc_shell")
    assert env.read_text() == "VITE_POSTHOG_API_KEY=\n"


def test_shell_value_without_dotenv_assignment_is_effective(tmp_path, monkeypatch):
    env = tmp_path / ".env"
    example = tmp_path / ".env.example"
    env.write_text("")
    example.write_text("POSTHOG_PERSONAL_API_KEY=\n")
    monkeypatch.setenv("POSTHOG_PERSONAL_API_KEY", "phx_shell")
    assert setup.ensure_env(env, example) == {"POSTHOG_PERSONAL_API_KEY": "phx_shell"}
    assert env.read_text() == ""


def test_missing_and_blank_generated_env_slots_are_filled_without_duplicates(tmp_path):
    env = tmp_path / ".env"
    example = tmp_path / ".env.example"
    env.write_text("POSTHOG_PROJECT_ID=\n")
    example.write_text("POSTHOG_PROJECT_ID=\nPOSTHOG_PERSONAL_API_KEY=\n")
    values = setup.ensure_env(env, example)
    assert values == {"POSTHOG_PROJECT_ID": "", "POSTHOG_PERSONAL_API_KEY": ""}
    assert env.read_text().count("POSTHOG_PROJECT_ID=") == 1
    assert env.read_text().count("POSTHOG_PERSONAL_API_KEY=") == 1


def test_populated_project_values_are_never_replaced(tmp_path):
    env = tmp_path / ".env"
    env.write_text("export POSTHOG_PROJECT_ID = 5\nVITE_POSTHOG_API_KEY=keep\n")
    try:
        setup.set_env_value(env, "POSTHOG_PROJECT_ID", "17")
    except RuntimeError as error:
        assert "does not match" in str(error)
    else:
        raise AssertionError("populated project id was replaced")
    assert (
        env.read_text() == "export POSTHOG_PROJECT_ID = 5\nVITE_POSTHOG_API_KEY=keep\n"
    )


def test_event_source_registers_s3_hogql_shape_and_reconciles_idempotently(tmp_path):
    s3 = json.loads(
        (Path(__file__).parent / "fixtures" / "posthog-s3-setup.json").read_text()
    )
    feature_dir = tmp_path / "features"
    feature_dir.mkdir()
    (feature_dir / "daily.yaml").write_text(
        "id: daily\nhappened: {event: section_expanded}\n"
        "could_have: {event: component_seen}\ngroup_by: [day, kind]\n"
    )

    class Client:
        saved = None
        writes = []
        created = 0
        definitions = []

        def list_insight_variables(self, project_id):
            return self.definitions

        def create_insight_variable(self, project_id, name, default):
            self.created += 1
            item = {
                "id": f"00000000-0000-0000-0000-{self.created:012d}",
                "name": name,
                "code_name": name.replace(" ", "_"),
                "type": "String",
                "default_value": default,
            }
            self.definitions.append(item)
            return item

        def get_endpoint(self, project_id, name):
            return {"name": name, "query": self.saved} if self.saved else None

        def create_endpoint(self, project_id, name, body):
            self.writes.append(("POST", project_id, name, body))
            self.saved = body

        def update_endpoint(self, project_id, name, body):
            self.writes.append(("PATCH", project_id, name, body))
            self.saved = body

    client = Client()
    assert s3["create"]["status"] == 201
    assert register_features(client, 17, feature_dir) == (1, 0)
    query = client.writes[0][3]
    assert query["kind"] == s3["api_calls"][0]["payload"]["query"]["kind"]
    assert all(
        f"{{variables.{name}}}" in query["query"]
        for name in ("daily_start", "daily_end", "daily_excluded_sessions")
    )
    assert len(query["variables"]) == 3
    assert register_features(client, 17, feature_dir) == (0, 1)
    assert len(client.writes) == 1


def test_loader_rejects_invalid_feature_contract(tmp_path):
    features = tmp_path / "features"
    features.mkdir()
    (features / "bad.yaml").write_text(
        "id: bad\ncould_have: {event: seen}\ngroup_by: [kind]\n"
    )

    class Client:
        def get_endpoint(self, *args):
            raise AssertionError("invalid feature reached the API")

    try:
        register_features(Client(), 1, features)
    except ValueError:
        pass
    else:
        raise AssertionError("engine Feature loader validation was bypassed")


def test_posthog_only_treats_lookup_404_as_absence():
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(404)
            self.end_headers()

        def do_POST(self):
            self.send_response(404)
            self.end_headers()

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        client = PostHog(f"http://127.0.0.1:{server.server_port}", "secret")
        assert client.get_endpoint(1, "missing") is None
        try:
            client.create_endpoint(
                1, "missing", {"kind": "HogQLQuery", "query": "SELECT 1"}
            )
        except RuntimeError as error:
            assert "HTTP 404" in str(error)
        else:
            raise AssertionError("write 404 was treated as absence")
    finally:
        server.shutdown()
        thread.join()
        server.server_close()


def test_hermes_requires_positive_status_and_recognizes_logged_out():
    assert setup.hermes_codex_signed_in("openai-codex: authenticated")
    assert not setup.hermes_codex_signed_in(
        "openai-codex: logged out (No Codex credentials stored.)"
    )
    assert not setup.hermes_codex_signed_in("")
    assert not setup.hermes_codex_signed_in("unrelated provider is authenticated")


def test_browser_gate_requires_tty_and_honors_all_ci_values(monkeypatch):
    stdin, stdout, opener = Mock(), Mock(), Mock(return_value=True)
    stdin.isatty.return_value = stdout.isatty.return_value = True
    monkeypatch.setattr(setup.sys, "stdin", stdin)
    monkeypatch.setattr(setup.sys, "stdout", stdout)
    monkeypatch.setattr(setup.webbrowser, "open", opener)
    monkeypatch.delenv("IMPLICITY_SETUP_NO_BROWSER", raising=False)
    for key in ("CI", "BROWSER", "DISPLAY", "WAYLAND_DISPLAY"):
        monkeypatch.delenv(key, raising=False)
    for value in ("true", "YES", "1"):
        monkeypatch.setenv("CI", value)
        assert not setup.open_posthog_if_interactive("http://localhost")
    monkeypatch.delenv("CI")
    assert setup.open_posthog_if_interactive("http://localhost")
    opener.assert_called_once_with("http://localhost")
    stdin.isatty.return_value = False
    assert not setup.open_posthog_if_interactive("http://localhost")


def test_setup_entry_migrates_before_manual_stop_and_prints_exact_instructions(
    tmp_path, monkeypatch, capsys
):
    monkeypatch.setattr(setup, "ROOT", tmp_path)
    (tmp_path / ".env.example").write_text(
        "POSTHOG_PERSONAL_API_KEY=\nPOSTHOG_PORT=18000\n"
    )
    monkeypatch.setattr(setup, "total_memory", lambda: 16 * 1024**3)
    monkeypatch.setattr(setup, "_healthy_stack", lambda: False)
    monkeypatch.setattr(setup, "_container_ids", lambda: ())
    calls = []
    monkeypatch.setattr(
        setup,
        "_run",
        lambda args, **kwargs: calls.append(args)
        or subprocess.CompletedProcess(args, 0, "", ""),
    )
    monkeypatch.setenv("IMPLICITY_SETUP_NO_BROWSER", "1")
    monkeypatch.delenv("CI", raising=False)
    assert setup.main() == 2
    out = capsys.readouterr().out
    migration = next(i for i, call in enumerate(calls) if "alembic" in call)
    assert migration < len(calls)
    assert "upgrade" in calls[migration] and "head" in calls[migration]
    assert (
        "create your account and then create a personal API key with "
        "project:read, project:write, endpoint:read, endpoint:write, "
        "insight_variable:read and insight_variable:write scopes." in out
    )
    assert (
        "Save the key as POSTHOG_PERSONAL_API_KEY in .env, then run make setup again."
        in out
    )


def test_setup_reports_alembic_diagnostic_and_stops(tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(setup, "ROOT", tmp_path)
    (tmp_path / ".env.example").write_text("POSTHOG_PERSONAL_API_KEY=\n")
    monkeypatch.setattr(setup, "total_memory", lambda: 16 * 1024**3)
    monkeypatch.setattr(setup, "_healthy_stack", lambda: False)
    monkeypatch.setattr(setup, "_container_ids", lambda: ())

    def run(args, **kwargs):
        if "alembic" in args:
            raise subprocess.CalledProcessError(
                255, args, stderr="Can't locate revision identified by 'bad_revision'"
            )
        return subprocess.CompletedProcess(args, 0, "", "")

    monkeypatch.setattr(setup, "_run", run)
    monkeypatch.setenv("IMPLICITY_SETUP_NO_BROWSER", "1")
    assert setup.main() == 255
    captured = capsys.readouterr()
    assert "Can't locate revision identified by 'bad_revision'" in captured.err
    assert "create your account" not in captured.out


def test_compose_web_wait_failure_is_propagated(monkeypatch):
    called = {}

    def failed_compose(args, *, check, **kwargs):
        called["check"] = check
        if check:
            raise subprocess.CalledProcessError(
                1, args, output="", stderr="web is unhealthy"
            )
        return subprocess.CompletedProcess(args, 1, "", "web is unhealthy")

    monkeypatch.setattr(setup.subprocess, "run", failed_compose)
    with pytest.raises(subprocess.CalledProcessError) as error:
        setup._run(
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
    assert called["check"] is True
    assert error.value.stderr == "web is unhealthy"


def test_setup_entry_drives_http_and_docker_boundaries_and_is_idempotent(
    tmp_path, monkeypatch, capsys
):
    state = {
        "requests": [],
        "endpoints": {},
        "responses": [],
        "order": [],
        "fail_writes": False,
        "fail_patch": False,
        "variables": [],
    }

    class Handler(BaseHTTPRequestHandler):
        def reply(self, status, data):
            state["responses"].append((status, data))
            encoded = json.dumps(data).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def do_GET(self):
            state["order"].append("http")
            state["requests"].append(("GET", self.path, None))
            if self.path == "/api/projects/":
                return self.reply(
                    200,
                    {
                        "results": [
                            {
                                "id": 17,
                                "name": "Default project",
                                "api_token": "phc_project",
                            }
                        ],
                        "next": None,
                    },
                )
            if self.path.endswith("/insight_variables/"):
                return self.reply(200, {"results": state["variables"]})
            name = self.path.rstrip("/").split("/")[-1]
            if name in state["endpoints"]:
                return self.reply(
                    200, {"name": name, "query": state["endpoints"][name]}
                )
            return self.reply(404, {})

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            state["order"].append("http")
            state["requests"].append(("POST", self.path, body))
            if state["fail_writes"]:
                return self.reply(500, {"detail": "write failed"})
            if self.path.endswith("/insight_variables/"):
                item = {
                    "id": f"00000000-0000-0000-0000-{len(state['variables']) + 1:012d}",
                    "name": body["name"],
                    "code_name": body["name"].replace(" ", "_"),
                    "type": body["type"],
                    "default_value": body["default_value"],
                }
                state["variables"].append(item)
                return self.reply(201, item)
            state["endpoints"][body["name"]] = body["query"]
            return self.reply(201, {"name": body["name"], "query": body["query"]})

        def do_PATCH(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            state["order"].append("http")
            state["requests"].append(("PATCH", self.path, body))
            name = self.path.rstrip("/").split("/")[-1]
            if state["fail_patch"]:
                return self.reply(404, {"detail": "missing"})
            state["endpoints"][name] = body["query"]
            return self.reply(200, {"name": name, "query": body["query"]})

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        monkeypatch.setattr(setup, "ROOT", tmp_path)
        (tmp_path / ".env.example").write_text(
            "HERMES_API_KEY=populated-secret\nPOSTHOG_PERSONAL_API_KEY=personal\nPOSTHOG_PROJECT_ID=\nVITE_POSTHOG_API_KEY=\nPOSTHOG_PORT="
            + str(server.server_port)
            + "\n"
        )
        env = tmp_path / ".env"
        env.write_text(
            "HERMES_API_KEY=populated-secret\nPOSTHOG_PERSONAL_API_KEY=personal\nPOSTHOG_PORT="
            + str(server.server_port)
            + "\n"
        )
        features = tmp_path / "contracts" / "features"
        features.mkdir(parents=True)
        (features / "daily.yaml").write_text(
            "id: daily\nhappened: {event: expanded}\n"
            "could_have: {event: seen}\ngroup_by: [day, kind]\n"
        )
        monkeypatch.setattr(setup, "total_memory", lambda: 16 * 1024**3)
        docker_calls = []
        service_ids = ["api-id", "web-id"]

        def docker(args, **kwargs):
            docker_calls.append(list(args))
            output = ""
            if args[:3] == ["docker", "compose", "--profile"] and "config" in args:
                output = json.dumps(
                    {"services": {"api-development": {}, "web-development": {}}}
                )
            elif "ps" in args and "--format" in args:
                output = "\n".join(
                    json.dumps({"State": "running", "Health": "healthy"})
                    for _ in service_ids
                )
            elif "ps" in args and "-q" in args:
                output = "\n".join(service_ids)
            elif "--force-recreate" in args:
                service_ids[:] = ["rotated-api", "rotated-web"]
            if "alembic" in args:
                state["order"].append("migration")
            if "auth" in args:
                state["order"].append("auth")
                output = auth["output"]
            return subprocess.CompletedProcess(args, 0, output, "")

        auth = {"output": "openai-codex: authenticated"}
        monkeypatch.setattr(setup.subprocess, "run", docker)
        monkeypatch.setenv("IMPLICITY_SETUP_NO_BROWSER", "1")
        monkeypatch.delenv("CI", raising=False)
        assert setup.main() == 0
        first_http = state["order"].index("http")
        assert (
            state["order"].index("migration")
            < first_http
            < state["order"].index("auth")
        )
        first_env = env.read_bytes()
        first_ids = setup._container_ids()
        assert first_ids == ("api-id", "web-id")
        assert docker_calls.count(["make", "up-development"]) == 1
        assert "populated-secret" in env.read_text()
        assert first_env.count(b"POSTHOG_PROJECT_ID=") == 1
        assert any("upgrade" in call and "head" in call for call in docker_calls)
        assert any(
            "--wait" in call and "web-development" in call for call in docker_calls
        )
        payload = next(
            body["query"]
            for method, path, body in state["requests"]
            if method == "POST" and path.endswith("/endpoints/")
        )
        assert len(payload["variables"]) == 3
        assert {item["value"] for item in payload["variables"].values()} == {
            "2000-01-01",
            "2100-01-01",
            "",
        }
        assert any(
            method == "POST"
            and path.endswith("/endpoints/")
            and body["query"]["kind"] == "HogQLQuery"
            for method, path, body in state["requests"]
        )
        create_response = next(
            body
            for method, path, body in state["requests"]
            if method == "POST" and path.endswith("/endpoints/")
        )
        assert set(create_response) == {"name", "query"}
        assert setup.main() == 0
        assert env.read_bytes() == first_env
        assert setup._container_ids() == first_ids
        assert not any("--force-recreate" in call for call in docker_calls)
        assert docker_calls.count(["make", "up-development"]) == 2
        assert not any(
            method == "POST" and path == "/api/projects/"
            for method, path, _ in state["requests"]
        )
        assert (
            sum(
                method == "POST" and path.endswith("/endpoints/")
                for method, path, _ in state["requests"]
            )
            == 1
        )
        assert (
            sum(
                method == "POST" and path.endswith("/insight_variables/")
                for method, path, _ in state["requests"]
            )
            == 3
        )
        assert "Compose: already healthy (no changes)" in capsys.readouterr().out
        auth["output"] = "openai-codex: logged out (No Codex credentials stored.)"
        assert setup.main() == 2
        logged_out = capsys.readouterr().out
        assert "hermes auth add openai-codex" in logged_out
        assert "No Codex credentials stored" not in logged_out
        auth["output"] = "unrecognized status: SECRET_MUST_NOT_LEAK"
        assert setup.main() == 1
        unknown_status = capsys.readouterr()
        assert "sign-in check failed" in unknown_status.err
        assert "SECRET_MUST_NOT_LEAK" not in unknown_status.out + unknown_status.err
        auth["output"] = "openai-codex: authenticated"
        original_env = env.read_text()
        for key, wrong in (
            ("POSTHOG_PROJECT_ID", "5"),
            ("VITE_POSTHOG_API_KEY", "phc_wrong"),
        ):
            current = env.read_text()
            before = current.replace(
                next(
                    line for line in current.splitlines() if line.startswith(f"{key}=")
                ),
                f"{key}={wrong}",
            )
            env.write_text(before + "\n")
            assert setup.main() == 1
            assert env.read_text() == before + "\n"
            assert f"{key} in .env does not match" in capsys.readouterr().err
            env.write_text(current)
        assert env.read_text() == original_env
        state["endpoints"]["daily"] = {"kind": "HogQLQuery", "query": "SELECT 1"}
        state["fail_patch"] = True
        auth["output"] = "openai-codex: authenticated"
        assert setup.main() == 1
        failed = capsys.readouterr()
        assert "Feature queries:" not in failed.out
        assert "HTTP 404" in failed.err
        assert any(method == "PATCH" for method, _, _ in state["requests"])
    finally:
        server.shutdown()
        thread.join()
        server.server_close()
