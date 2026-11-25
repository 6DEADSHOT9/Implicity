import json
import urllib.error
import urllib.request
from pathlib import Path


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
            raise RuntimeError(
                f"PostHog API {method} {path} returned HTTP {error.code}"
            ) from error

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


def ensure_project(client, name: str) -> tuple[dict, bool]:
    existing = next(
        (item for item in client.list_projects() if item["name"] == name), None
    )
    return (existing, False) if existing else (client.create_project(name), True)


def feature_query(feature) -> dict:
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
    happened_count = (
        f"countIf(event = {literal(happened['event'])} AND ({where(happened)}))"
        if happened
        else "0"
    )
    sql = (
        "SELECT toDate(timestamp) AS day, properties['kind'] AS kind, "
        f"groupUniqArrayIf(properties['conversation_id'], event = "
        f"{literal(chance['event'])} AND ({where(chance)})) AS conversation_ids, "
        f"{happened_count} AS happened, countIf(event = "
        f"{literal(chance['event'])} AND ({where(chance)})) AS could_have "
        f"FROM events WHERE event IN ({', '.join(literal(event) for event in events)}) "
        "AND timestamp >= toDateTime({variables.start}) "
        "AND timestamp < toDateTime({variables.end}) "
        "AND properties['session_id'] NOT IN {variables.excluded_sessions} "
        "GROUP BY day, kind ORDER BY day, kind"
    )
    return {"kind": "HogQLQuery", "query": sql}


def ensure_feature(client, project_id: int, feature) -> bool:
    query = feature_query(feature)
    existing = client.get_endpoint(project_id, feature.id)
    if existing is None:
        client.create_endpoint(project_id, feature.id, query)
        return True
    current = existing.get("query") or {}
    if isinstance(current, str):
        current = {"kind": "HogQLQuery", "query": current}
    if (
        current.get("kind") == query["kind"]
        and current.get("query") == query["query"]
        and current.get("variables", {}) == query.get("variables", {})
    ):
        return False
    client.update_endpoint(project_id, feature.id, query)
    return True


def register_features(client, project_id: int, directory: Path) -> tuple[int, int]:
    from implicity_engine.evidence import load_feature

    features = [load_feature(path) for path in sorted(directory.glob("*.yaml"))]
    changed = sum(ensure_feature(client, project_id, feature) for feature in features)
    return changed, len(features) - changed
