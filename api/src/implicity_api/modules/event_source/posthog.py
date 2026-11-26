import json
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path
from zoneinfo import ZoneInfo

from implicity_engine import EventSourceUnavailable
from implicity_engine.evidence import DailyCount, load_feature


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
            if error.code == 404 and method == "GET":
                return None
            try:
                detail = error.read().decode(errors="replace")[:500]
            except OSError:
                detail = ""
            if error.code >= 500:
                raise EventSourceUnavailable(
                    f"PostHog API {method} {path} returned HTTP {error.code}: {detail}"
                ) from error
            raise RuntimeError(
                f"PostHog API {method} {path} returned HTTP {error.code}: {detail}"
            ) from error
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            raise EventSourceUnavailable(str(error)) from error

    def run_endpoint(self, project_id: int, name: str, variables: dict):
        return self.request(
            "POST",
            f"/api/environments/{project_id}/endpoints/{name}/run/",
            {"variables": variables},
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
        return response.get("results", []) if response else []

    def create_insight_variable(self, project_id: int, name: str, default: str):
        return self.request(
            "POST",
            f"/api/environments/{project_id}/insight_variables/",
            {"name": name, "type": "String", "default_value": default},
        )

    def get_endpoint(self, project_id: int, name: str):
        return self.request("GET", f"/api/environments/{project_id}/endpoints/{name}/")

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


def feature_query(feature, variables, local_timezone="UTC") -> dict:
    def literal(value):
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, (int, float)):
            return str(value)
        return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'") + "'"

    def where(selector):
        return (
            " AND ".join(
                f"properties[{literal(key)}] = {literal(value)}"
                for key, value in sorted(selector.get("where", {}).items())
            )
            or "1"
        )

    chance = feature.could_have
    happened = feature.happened
    events = [selector["event"] for selector in (happened, chance) if selector]

    def variable(name):
        return "{variables." + variables[name]["code_name"] + "}"

    happened_count = (
        f"countIf(event = {literal(happened['event'])} AND ({where(happened)}))"
        if happened
        else "0"
    )
    sql = (
        f"SELECT toDate(timestamp, {literal(local_timezone)}) AS day, "
        "properties['kind'] AS kind, "
        f"groupUniqArrayIf(properties['conversation_id'], event = "
        f"{literal(chance['event'])} AND ({where(chance)})) AS conversation_ids, "
        f"{happened_count} AS happened, countIf(event = "
        f"{literal(chance['event'])} AND ({where(chance)})) AS could_have "
        f"FROM events WHERE event IN ({', '.join(literal(event) for event in events)}) "
        f"AND toDate(timestamp, {literal(local_timezone)}) >= "
        f"toDate({variable('start')}) "
        f"AND toDate(timestamp, {literal(local_timezone)}) <= "
        f"toDate({variable('end')}) "
        f"AND (empty({variable('excluded_sessions')}) OR "
        f"NOT has(splitByChar(',', "
        f"{{variables.{variables['excluded_sessions']['code_name']}}}), "
        "properties['session_id'])) "
        "GROUP BY day, kind ORDER BY day, kind"
    )
    return {
        "kind": "HogQLQuery",
        "query": sql,
        "variables": {binding["variableId"]: binding for binding in variables.values()},
    }


def ensure_feature(
    client, project_id: int, feature, variables, local_timezone="UTC"
) -> bool:
    query = feature_query(feature, variables, local_timezone)
    existing = client.get_endpoint(project_id, feature.id)
    if existing is None:
        client.create_endpoint(project_id, feature.id, query)
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
        and meaningful(current.get("variables", {})) == meaningful(query["variables"])
    ):
        return False
    client.update_endpoint(project_id, feature.id, query)
    return True


def _bindings(client, project_id, definitions, name):
    bindings = {}
    for variable, default in (
        ("start", "2000-01-01"),
        ("end", "2100-01-01"),
        ("excluded_sessions", ""),
    ):
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
        bindings = _bindings(client, project_id, definitions, feature.id)
        changed += ensure_feature(client, project_id, feature, bindings, local_timezone)
    session_bindings = _bindings(client, project_id, definitions, "session_summaries")
    changed += ensure_endpoint(
        client,
        project_id,
        "session_summaries",
        session_summary_query(session_bindings, local_timezone),
    )
    total = len(features) + 1
    return changed, total - changed


def session_summary_query(variables, local_timezone="UTC"):
    def literal(value):
        return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'") + "'"

    zone = literal(local_timezone)

    def variable(name):
        return "{variables." + variables[name]["code_name"] + "}"

    sql = (
        "SELECT uuid AS event_id, timestamp, properties FROM events "
        "WHERE event = 'session_summary' "
        f"AND toDate(timestamp, {zone}) >= toDate({variable('start')}) "
        f"AND toDate(timestamp, {zone}) <= toDate({variable('end')}) "
        f"AND (empty({variable('excluded_sessions')}) OR "
        "NOT has(splitByChar(',', "
        f"{variable('excluded_sessions')}), properties['session_id']))"
    )
    return {
        "kind": "HogQLQuery",
        "query": sql,
        "variables": {binding["variableId"]: binding for binding in variables.values()},
    }


def ensure_endpoint(client, project_id, name, query):
    existing = client.get_endpoint(project_id, name)
    if existing is None:
        client.create_endpoint(project_id, name, query)
        return True
    current = existing.get("query") or {}
    if isinstance(current, str):
        current = {"kind": "HogQLQuery", "query": current}
    if current == query:
        return False
    client.update_endpoint(project_id, name, query)
    return True


class PostHogEventSource:
    def __init__(
        self, client: PostHog, project_id: int, directory: Path, local_timezone="UTC"
    ):
        self.client = client
        self.project_id = project_id
        self.local_timezone = ZoneInfo(local_timezone)
        self.zone_name = local_timezone
        self.features = {
            feature.id: feature
            for feature in (
                load_feature(path) for path in sorted(directory.glob("*.yaml"))
            )
        }
        definitions = {
            item["name"]: item for item in client.list_insight_variables(project_id)
        }
        self.variables = {}
        for name in [*self.features, "session_summaries"]:
            self.variables[name] = {
                key: definitions[f"{name} {key}"]["code_name"]
                for key in ("start", "end", "excluded_sessions")
            }

    def _run(self, name, start, end, exclude_sessions):
        variables = self.variables[name]
        values = {
            variables["start"]: start.isoformat(),
            variables["end"]: end.isoformat(),
            variables["excluded_sessions"]: ",".join(map(str, exclude_sessions)),
        }
        return self.client.run_endpoint(self.project_id, name, values)

    @staticmethod
    def _rows(response):
        if isinstance(response, list):
            return response
        results = response.get("results", [])
        columns = response.get("columns", [])
        if results and isinstance(results[0], dict):
            return results
        return [dict(zip(columns, row)) for row in results]

    def daily_counts(self, feature, start: date, end: date, exclude_sessions=()):
        result = self._run(feature, start, end, exclude_sessions)
        return [
            DailyCount(
                date.fromisoformat(str(row["day"])[:10]),
                str(row["kind"]),
                int(row["happened"]),
                int(row["could_have"]),
                frozenset(row["conversation_ids"] or ()),
            )
            for row in self._rows(result)
        ]

    def session_summaries(self, start: date, end: date, exclude_sessions=()):
        from implicity_contracts.generated import SessionSummary

        rows = self._rows(self._run("session_summaries", start, end, exclude_sessions))
        return [
            SessionSummary.model_validate(
                {
                    **row.get("properties", {}),
                    "event_id": row["event_id"],
                    "timestamp": row["timestamp"],
                }
            )
            for row in rows
        ]


def create_event_source(client, project_id: int, directory: Path, local_timezone=None):
    import os

    return PostHogEventSource(
        client, project_id, directory, local_timezone or os.environ.get("TZ", "UTC")
    )
