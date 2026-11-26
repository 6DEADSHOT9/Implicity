import json
import os
import sys
import urllib.error
import urllib.request
import webbrowser
from datetime import date
from http.client import IncompleteRead
from pathlib import Path
from typing import Sequence
from zoneinfo import ZoneInfo

from implicity_contracts.generated import SessionSummary
from implicity_engine import EventSourceUnavailable
from implicity_engine.evidence import DailyCount, load_feature


class PostHog:
    def __init__(self, base_url: str, personal_key: str):
        self.base_url = base_url.rstrip("/")
        self.personal_key = personal_key

    def request(self, method: str, path: str, body=None, *, missing_ok=False):
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
            if error.code == 404 and missing_ok:
                return None
            try:
                detail = error.read().decode(errors="replace")[:500]
            except IncompleteRead as truncated:
                detail = truncated.partial.decode(errors="replace")[:500]
            except OSError:
                detail = ""
            if error.code >= 500:
                raise EventSourceUnavailable(
                    f"PostHog API {method} {path} returned HTTP {error.code}: {detail}"
                ) from error
            raise RuntimeError(
                f"PostHog API {method} {path} returned HTTP {error.code}: {detail}"
            ) from error
        except (OSError, IncompleteRead) as error:
            raise EventSourceUnavailable(str(error)) from error

    def run_endpoint(self, project_id: int, name: str, variables: dict, *, offset: int):
        return self.request(
            "POST",
            f"/api/environments/{project_id}/endpoints/{name}/run/",
            {"variables": variables, "limit": 100, "offset": offset},
        )

    def list_projects(self):
        page, results = "/api/projects/", []
        while page:
            response = self.request("GET", page)
            results.extend(response.get("results", []))
            page = response.get("next") or ""
            if page.startswith(self.base_url):
                page = page[len(self.base_url) :]
        return results

    def create_project(self, name: str):
        return self.request("POST", "/api/projects/", {"name": name})

    def list_insight_variables(self, project_id: int):
        response = self.request(
            "GET", f"/api/environments/{project_id}/insight_variables/"
        )
        return response["results"]

    def create_insight_variable(self, project_id: int, name: str, default: str):
        return self.request(
            "POST",
            f"/api/environments/{project_id}/insight_variables/",
            {"name": name, "type": "String", "default_value": default},
        )

    def get_endpoint(self, project_id: int, name: str):
        return self.request(
            "GET", f"/api/environments/{project_id}/endpoints/{name}/", missing_ok=True
        )

    def create_endpoint(self, project_id: int, name: str, query: dict):
        return self.request(
            "POST",
            f"/api/environments/{project_id}/endpoints/",
            {"name": name, "query": query},
        )

    def update_endpoint(self, project_id: int, name: str, query: dict):
        return self.request(
            "PATCH",
            f"/api/environments/{project_id}/endpoints/{name}/",
            {"query": query},
        )


def ensure_project(client, name: str, allow_sole: bool = True) -> tuple[dict, bool]:
    projects = client.list_projects()
    existing = next((item for item in projects if item["name"] == name), None)
    if existing:
        return existing, False
    if allow_sole and len(projects) == 1:
        return projects[0], False
    if not projects:
        return client.create_project(name), True
    if not allow_sole:
        available = ", ".join(item["name"] for item in projects)
        raise RuntimeError(
            f"PostHog project {name!r} was not found. Existing projects: {available}. "
            "Create it in PostHog or set POSTHOG_PROJECT_NAME to an existing project."
        )
    raise RuntimeError(
        "Multiple PostHog projects found; set POSTHOG_PROJECT_NAME in .env"
    )


SESSION_SUMMARIES = "session_summaries"
WINDOW_DEFAULTS = {
    "start": "2000-01-01",
    "end": "2100-01-01",
    "excluded_sessions": "",
    "zone": "UTC",
}


def _window(variables):
    codes = {
        name: "{variables." + binding["code_name"] + "}"
        for name, binding in variables.items()
    }
    day = f"toDate(timestamp, {codes['zone']})"
    excluded = codes["excluded_sessions"]
    predicate = (
        f"{day} >= toDate({codes['start']}) AND "
        f"{day} <= toDate({codes['end']}) AND "
        f"(empty({excluded}) OR "
        f"NOT has(splitByChar(',', {excluded}), properties['session_id']))"
    )
    return day, predicate


def _saved_query(sql, variables):
    return {
        "kind": "HogQLQuery",
        "query": sql,
        "variables": {binding["variableId"]: binding for binding in variables.values()},
    }


def feature_query(feature, variables):
    def literal(value):
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, (int, float)):
            return str(value)
        return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'") + "'"

    def matches(selector):
        terms = [f"event = {literal(selector['event'])}"]
        terms.extend(
            f"properties[{literal(key)}] = {literal(value)}"
            for key, value in sorted(selector.get("where", {}).items())
        )
        return " AND ".join(terms)

    occasion = matches(feature.could_have)
    happened = matches(feature.happened) if feature.happened else None
    selected = f"({occasion}) OR ({happened})" if happened else occasion
    happened_count = f"countIf({happened})" if happened else "0"
    day, window = _window(variables)
    return _saved_query(
        f"SELECT {day} AS day, properties['kind'] AS kind, "
        f"groupUniqArrayIf(properties['conversation_id'], {occasion}) "
        "AS conversation_ids, "
        f"{happened_count} AS happened, countIf({occasion}) AS could_have "
        f"FROM events WHERE ({selected}) AND {window} "
        "GROUP BY day, kind ORDER BY day, kind",
        variables,
    )


def session_summary_query(variables):
    _, window = _window(variables)
    return _saved_query(
        "SELECT uuid AS event_id, timestamp, properties FROM events "
        f"WHERE event = 'session_summary' AND {window} ORDER BY timestamp, uuid",
        variables,
    )


def ensure_endpoint(client, project_id, name, query):
    existing = client.get_endpoint(project_id, name)
    if existing is None:
        client.create_endpoint(project_id, name, query)
        return True
    current = existing.get("query") or {}
    if isinstance(current, str):
        current = {"kind": "HogQLQuery", "query": current}

    def meaningful(bindings):
        return {
            key: {
                field: value.get(field)
                for field in ("variableId", "code_name", "value")
            }
            for key, value in bindings.items()
        }

    if (
        current.get("kind") == query["kind"]
        and current.get("query") == query["query"]
        and meaningful(current.get("variables") or {}) == meaningful(query["variables"])
    ):
        return False
    client.update_endpoint(project_id, name, query)
    return True


def _bindings(client, project_id, definitions, name, local_timezone):
    bindings = {}
    for variable, default in (WINDOW_DEFAULTS | {"zone": local_timezone}).items():
        variable_name = f"{name} {variable}"
        definition = definitions.get(variable_name)
        if definition is None:
            definition = client.create_insight_variable(
                project_id, variable_name, default
            )
            definitions[variable_name] = definition
        if definition.get("type") != "String":
            raise RuntimeError(
                f"PostHog variable {variable_name} must have type String"
            )
        bindings[variable] = {
            "variableId": definition["id"],
            "code_name": definition["code_name"],
            "value": default,
        }
    return bindings


def register_features(
    client, project_id: int, directory: Path, local_timezone="UTC"
) -> tuple[int, int]:
    features = [load_feature(path) for path in sorted(directory.glob("*.yaml"))]
    definitions = {
        item["name"]: item for item in client.list_insight_variables(project_id)
    }
    changed = 0
    for feature in features:
        bindings = _bindings(
            client, project_id, definitions, feature.id, local_timezone
        )
        changed += ensure_endpoint(
            client, project_id, feature.id, feature_query(feature, bindings)
        )
    bindings = _bindings(
        client, project_id, definitions, SESSION_SUMMARIES, local_timezone
    )
    changed += ensure_endpoint(
        client, project_id, SESSION_SUMMARIES, session_summary_query(bindings)
    )
    return changed, len(features) + 1 - changed


class PostHogEventSource:
    def __init__(
        self, client: PostHog, project_id: int, directory: Path, local_timezone="UTC"
    ):
        self.client = client
        self.project_id = project_id
        self.local_timezone = ZoneInfo(local_timezone)
        names = [load_feature(path).id for path in sorted(directory.glob("*.yaml"))]
        definitions = {
            item["name"]: item["code_name"]
            for item in client.list_insight_variables(project_id)
        }
        self.variables = {}
        for name in [*names, SESSION_SUMMARIES]:
            bindings = {}
            for key in WINDOW_DEFAULTS:
                identifier = f"{name} {key}"
                if identifier not in definitions:
                    raise RuntimeError(
                        f"PostHog variable {identifier} is missing; rerun setup"
                    )
                bindings[key] = definitions[identifier]
            self.variables[name] = bindings

    def _run(self, name, start, end, exclude_sessions):
        variables = self.variables[name]
        values = {
            variables["start"]: start.isoformat(),
            variables["end"]: end.isoformat(),
            variables["excluded_sessions"]: ",".join(map(str, exclude_sessions)),
            variables["zone"]: self.local_timezone.key,
        }
        offset = 0
        while True:
            response = self.client.run_endpoint(
                self.project_id, name, values, offset=offset
            )
            rows = self._rows(response)
            yield from rows
            if not response.get("hasMore"):
                return
            if not rows:
                raise RuntimeError("PostHog returned an empty page with hasMore set")
            offset += len(rows)

    @staticmethod
    def _rows(response):
        results = response.get("results", [])
        columns = response.get("columns", [])
        if results and isinstance(results[0], dict):
            return results
        return [dict(zip(columns, row)) for row in results]

    def daily_counts(
        self,
        feature: str,
        start: date,
        end: date,
        exclude_sessions: Sequence[str] = (),
    ) -> list[DailyCount]:
        return [
            DailyCount(
                date.fromisoformat(str(row["day"])[:10]),
                str(row["kind"]),
                int(row["happened"]),
                int(row["could_have"]),
                frozenset(row["conversation_ids"] or ()),
            )
            for row in self._run(feature, start, end, exclude_sessions)
        ]

    def session_summaries(
        self,
        start: date,
        end: date,
        exclude_sessions: Sequence[str] = (),
    ) -> list[SessionSummary]:
        summaries = []
        for row in self._run(SESSION_SUMMARIES, start, end, exclude_sessions):
            properties = row["properties"]
            if isinstance(properties, str):
                properties = json.loads(properties)
            payload = {
                field: properties[field]
                for field in SessionSummary.model_fields
                if field in properties
            }
            payload.setdefault("event_id", row["event_id"])
            payload.setdefault("name", "session_summary")
            payload["timestamp"] = row["timestamp"]
            summaries.append(SessionSummary.model_validate_json(json.dumps(payload)))
        return summaries


def create_event_source(client, project_id: int, directory: Path, local_timezone=None):
    return PostHogEventSource(
        client, project_id, directory, local_timezone or os.environ.get("TZ") or "UTC"
    )


EVENT_STORE_SECRET_BYTES = {
    "POSTHOG_DB_PASSWORD": 32,
    "POSTHOG_CH_PASSWORD": 32,
    "POSTHOG_SECRET": 32,
    "POSTHOG_ENCRYPTION_SALT_KEYS": 16,
}


def open_posthog_if_interactive(url: str) -> bool:
    if (
        sys.stdin.isatty()
        and sys.stdout.isatty()
        and os.getenv("IMPLICITY_SETUP_NO_BROWSER") != "1"
        and os.getenv("CI", "").strip().lower() not in {"1", "true", "yes"}
    ):
        return webbrowser.open(url)
    return False


def configure_event_store(values, features, *, save_setting, refresh_capture) -> int:
    posthog_port = os.environ.get("POSTHOG_PORT", values.get("POSTHOG_PORT", "18000"))
    posthog_url = f"http://127.0.0.1:{posthog_port}"
    personal_key = values.get("POSTHOG_PERSONAL_API_KEY", "")
    if not personal_key:
        print(
            f"PostHog needs one-time setup at {posthog_url}: create your account and "
            "then create a personal API key with project:read, project:write, "
            "endpoint:read, endpoint:write, insight_variable:read and "
            "insight_variable:write scopes."
        )
        open_posthog_if_interactive(posthog_url)
        print(
            "Save the key as POSTHOG_PERSONAL_API_KEY in .env, then "
            "run make setup again."
        )
        return 2

    client = PostHog(posthog_url, personal_key)
    project_name = values.get("POSTHOG_PROJECT_NAME") or "Implicity"
    project, project_created = ensure_project(
        client, project_name, allow_sole=not bool(values.get("POSTHOG_PROJECT_NAME"))
    )
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
        save_setting("POSTHOG_PROJECT_ID", str(project_id))
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
        save_setting("VITE_POSTHOG_API_KEY", project_key)
        values["VITE_POSTHOG_API_KEY"] = project_key
        refresh_capture()
    print(
        "PostHog project key: stored"
        if project_key_changed
        else "PostHog project key: already present (skipped)"
    )

    changed, unchanged = register_features(
        client, project_id, features, values.get("TZ") or "UTC"
    )
    print(
        f"Feature queries: {changed} created or updated, {unchanged} unchanged"
        if changed + unchanged
        else "Feature queries: skipped (no Feature definitions yet)"
    )
    return 0
