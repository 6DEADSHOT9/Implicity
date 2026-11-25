from unittest.mock import Mock

from implicity_api.setup import (
    ensure_env,
    ensure_feature,
    ensure_project,
    feature_query,
    hermes_codex_signed_in,
    memory_sufficient,
    open_posthog_if_interactive,
)


def test_memory_requires_at_least_16_gib() -> None:
    assert memory_sufficient(16 * 1024**3)
    assert not memory_sufficient(16 * 1024**3 - 1)


def test_existing_env_values_are_kept(tmp_path) -> None:
    example = tmp_path / ".env.example"
    example.write_text("SECRET=replace-with-secret\nPORT=1234\n")
    env = tmp_path / ".env"
    env.write_text("SECRET=keep-me\nPORT=9000\n")

    values = ensure_env(env, example, token_hex=lambda _: "generated")

    assert values == {"SECRET": "keep-me", "PORT": "9000"}
    assert env.read_text() == "SECRET=keep-me\nPORT=9000\n"


def test_missing_env_is_created_from_template_and_secrets_are_generated(
    tmp_path,
) -> None:
    example = tmp_path / ".env.example"
    example.write_text("SECRET=replace-with-openssl-rand-hex-32\nPORT=1234\n")
    env = tmp_path / ".env"

    values = ensure_env(env, example, token_hex=lambda size: f"generated-{size}")

    assert values == {"SECRET": "generated-32", "PORT": "1234"}
    assert env.stat().st_mode & 0o777 == 0o600


def test_ensure_project_leaves_existing_project_unchanged() -> None:
    class Client:
        created = False

        def list_projects(self):
            return [{"id": 1, "name": "Implicity", "api_token": "phc_test"}]

        def create_project(self, name):
            self.created = True
            raise AssertionError("existing project should be reused")

    client = Client()
    assert ensure_project(client, "Implicity") == (
        {"id": 1, "name": "Implicity", "api_token": "phc_test"},
        False,
    )
    assert not client.created


def test_ensure_project_creates_when_missing() -> None:
    class Client:
        def list_projects(self):
            return []

        def create_project(self, name):
            return {"id": 2, "name": name, "api_token": "phc_test"}

    assert ensure_project(Client(), "Implicity") == (
        {"id": 2, "name": "Implicity", "api_token": "phc_test"},
        True,
    )


def test_unchanged_feature_is_not_written() -> None:
    class Client:
        writes = 0

        def get_endpoint(self, project_id, name):
            return {"name": name, "query": "SELECT 1"}

        def create_endpoint(self, project_id, name, query):
            self.writes += 1

        def update_endpoint(self, project_id, name, query):
            self.writes += 1

    client = Client()
    assert not ensure_feature(client, 1, "count_feature", "SELECT 1")
    assert client.writes == 0


def test_feature_query_builds_daily_counts_and_handles_occasion_only_features() -> None:
    feature = {
        "id": "long_answer_expanded",
        "happened": {"event": "section_expanded", "where": {"slot": "long_answer"}},
        "could_have": {
            "event": "component_seen",
            "where": {"component": "MessageBody", "slot": "long_answer"},
        },
    }

    query = feature_query(feature)
    assert "toDate(timestamp) AS day" in query
    assert "properties.kind AS kind" in query
    assert "AS conversation_ids" in query
    assert "countIf(event = 'section_expanded'" in query
    assert "countIf(event = 'component_seen'" in query

    occasion_only = feature_query(
        {"id": "session_seen", "could_have": {"event": "session_seen"}}
    )
    assert "0 AS happened" in occasion_only


def test_feature_is_created_or_updated_only_when_needed() -> None:
    class Client:
        def __init__(self, existing):
            self.existing = existing
            self.created = self.updated = 0

        def get_endpoint(self, project_id, name):
            return self.existing

        def create_endpoint(self, project_id, name, query):
            self.created += 1

        def update_endpoint(self, project_id, name, query):
            self.updated += 1

    missing = Client(None)
    changed = Client({"query": "SELECT 1"})
    assert ensure_feature(missing, 1, "new_feature", "SELECT 2")
    assert ensure_feature(changed, 1, "old_feature", "SELECT 2")
    assert (missing.created, missing.updated) == (1, 0)
    assert (changed.created, changed.updated) == (0, 1)


def test_missing_hermes_codex_sign_in_is_detected_without_exposing_output() -> None:
    assert not hermes_codex_signed_in(
        "openai-codex: logged out (No Codex credentials stored.)"
    )
    assert hermes_codex_signed_in("openai-codex: authenticated")


def test_posthog_browser_opens_only_for_interactive_runs(monkeypatch) -> None:
    stdin = Mock()
    stdout = Mock()
    stdin.isatty.return_value = True
    stdout.isatty.return_value = True
    open_browser = Mock(return_value=True)
    monkeypatch.setattr("implicity_api.setup.sys.stdin", stdin)
    monkeypatch.setattr("implicity_api.setup.sys.stdout", stdout)
    monkeypatch.setattr("implicity_api.setup.webbrowser.open", open_browser)
    monkeypatch.delenv("IMPLICITY_SETUP_NO_BROWSER", raising=False)
    monkeypatch.delenv("CI", raising=False)

    assert open_posthog_if_interactive("http://localhost")
    open_browser.assert_called_once_with("http://localhost")


def test_posthog_browser_stays_closed_for_noninteractive_runs(monkeypatch) -> None:
    stdin = Mock()
    stdout = Mock()
    stdin.isatty.return_value = False
    stdout.isatty.return_value = True
    open_browser = Mock()
    monkeypatch.setattr("implicity_api.setup.sys.stdin", stdin)
    monkeypatch.setattr("implicity_api.setup.sys.stdout", stdout)
    monkeypatch.setattr("implicity_api.setup.webbrowser.open", open_browser)

    assert not open_posthog_if_interactive("http://localhost")
    stdin.isatty.return_value = True
    stdout.isatty.return_value = False
    assert not open_posthog_if_interactive("http://localhost")
    open_browser.assert_not_called()


def test_posthog_browser_opt_out_and_ci_stay_closed(monkeypatch) -> None:
    stdin = Mock()
    stdout = Mock()
    stdin.isatty.return_value = True
    stdout.isatty.return_value = True
    open_browser = Mock()
    monkeypatch.setattr("implicity_api.setup.sys.stdin", stdin)
    monkeypatch.setattr("implicity_api.setup.sys.stdout", stdout)
    monkeypatch.setattr("implicity_api.setup.webbrowser.open", open_browser)

    monkeypatch.setenv("IMPLICITY_SETUP_NO_BROWSER", "1")
    monkeypatch.delenv("CI", raising=False)
    assert not open_posthog_if_interactive("http://localhost")
    monkeypatch.delenv("IMPLICITY_SETUP_NO_BROWSER")
    monkeypatch.setenv("CI", "1")
    assert not open_posthog_if_interactive("http://localhost")
    open_browser.assert_not_called()
