import json
import re
import sqlite3
import threading
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from uuid import UUID
from zoneinfo import ZoneInfo

import pytest
import yaml
from implicity_api.modules.event_source.posthog import (
    PostHog,
    create_event_source,
    register_features,
)
from implicity_contracts.codec import decode_contract
from implicity_engine import DailyCount, EventSourceUnavailable, FakeEventSource
from test_contracts import SESSION_SUMMARY

ZONE = "Asia/Kolkata"
START = date(2026, 11, 26)
END = date(2026, 11, 27)
SKIP = "550e8400-e29b-41d4-a716-446655440001"


class Occasions:
    def __init__(self):
        self.ids = set()

    def step(self, conversation, matches):
        if matches and conversation is not None:
            self.ids.add(conversation)

    def finalize(self):
        return json.dumps(sorted(self.ids))


class Count:
    def __init__(self):
        self.total = 0

    def step(self, matches):
        self.total += bool(matches)

    def finalize(self):
        return self.total


def run_saved_query(query, body, events):
    bindings = {
        item["code_name"]: item["value"] for item in query["variables"].values()
    }
    overrides = body["variables"]
    assert overrides.keys() <= bindings.keys()
    bindings.update(overrides)
    sql = re.sub(r"\{variables\.([^}]+)\}", r":\1", query["query"])
    sql = re.sub(r"properties\['([^']+)'\]", r"json_extract(properties, '$.\1')", sql)

    with sqlite3.connect(":memory:") as db:
        db.execute("CREATE TABLE events (event, timestamp, properties, uuid)")
        db.executemany("INSERT INTO events VALUES (?, ?, ?, ?)", events)
        db.create_function("toDate", 1, lambda value: value[:10])
        db.create_function(
            "toDate",
            2,
            lambda value, zone: datetime.fromisoformat(value)
            .astimezone(ZoneInfo(zone))
            .date()
            .isoformat(),
        )
        db.create_function("empty", 1, lambda value: not value)
        db.create_function(
            "splitByChar", 2, lambda sep, value: json.dumps(value.split(sep))
        )
        db.create_function("has", 2, lambda values, value: value in json.loads(values))
        db.create_aggregate("groupUniqArrayIf", 2, Occasions)
        db.create_aggregate("countIf", 1, Count)
        cursor = db.execute(sql, bindings)
        columns = [column[0] for column in cursor.description]
        rows = cursor.fetchall()

    limit = body.get("limit", 100)
    offset = body.get("offset", 0)
    results = [
        [
            json.loads(value) if column in {"conversation_ids", "properties"} else value
            for column, value in zip(columns, row)
        ]
        for row in rows[offset : offset + limit]
    ]
    return {
        "results": results,
        "columns": columns,
        "hasMore": offset + limit < len(rows),
    }


@pytest.fixture
def event_store(request):
    definitions, endpoints, events, runs = [], {}, [], []
    failures = {}
    if getattr(request, "param", None) == "full_variable_page":
        definitions.extend(
            {
                "id": str(UUID(int=index)),
                "name": f"existing variable {index}",
                "code_name": f"v_{index}",
                "type": "String",
            }
            for index in range(1, 501)
        )

    class Handler(BaseHTTPRequestHandler):
        def reply(self, status, payload, truncated=False):
            body = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header(
                "Content-Length", str(len(body) + (100 if truncated else 0))
            )
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path in failures:
                return self.reply(*failures[self.path])
            path = urlsplit(self.path)
            if path.path.endswith("/insight_variables/"):
                offset = int(parse_qs(path.query).get("offset", [0])[0])
                end = offset + 500
                next_page = None
                if end < len(definitions):
                    next_page = f"http://{self.headers['Host']}{path.path}?offset={end}"
                return self.reply(
                    200, {"results": definitions[offset:end], "next": next_page}
                )
            name = self.path.rstrip("/").split("/")[-1]
            if name not in endpoints:
                return self.reply(404, {"detail": "missing endpoint"})
            query = json.loads(json.dumps(endpoints[name]))
            query["explain"] = None
            for binding in query["variables"].values():
                binding["isNull"] = None
            return self.reply(200, {"query": query})

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            if self.path in failures:
                return self.reply(*failures[self.path])
            if self.path.endswith("/insight_variables/"):
                if any(item["name"] == body["name"] for item in definitions):
                    return self.reply(400, {"detail": "duplicate variable code name"})
                item = {
                    "id": str(UUID(int=len(definitions) + 1)),
                    "name": body["name"],
                    "code_name": f"v_{len(definitions) + 1}",
                    "type": body["type"],
                }
                definitions.append(item)
                return self.reply(201, item)
            if self.path.endswith("/endpoints/"):
                endpoints[body["name"]] = body["query"]
                return self.reply(201, {})
            name = self.path.split("/")[-3]
            runs.append((name, body))
            try:
                result = run_saved_query(endpoints[name], body, events)
            except (AssertionError, KeyError, sqlite3.Error) as error:
                return self.reply(400, {"detail": str(error)})
            return self.reply(200, result)

        def do_PATCH(self):
            self.reply(500, {"detail": f"unexpected write to {self.path}"})

        def log_message(self, *_):
            pass

    with ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            client = PostHog(f"http://127.0.0.1:{server.server_port}", "test-key")
            yield client, events, runs, failures
        finally:
            server.shutdown()
            worker.join()


@pytest.fixture
def features(tmp_path):
    occasion = (
        "could_have: {event: seen, where: {slot: long_answer}}\ngroup_by: [day, kind]\n"
    )
    (tmp_path / "expanded.yaml").write_text(
        "id: expanded\nhappened: {event: expanded, where: {slot: long_answer}}\n"
        + occasion
    )
    (tmp_path / "seen.yaml").write_text("id: seen\n" + occasion)
    return tmp_path


def action(
    timestamp,
    name="seen",
    session="s1",
    conversation="c1",
    kind="coding",
    slot="long_answer",
):
    properties = dict(
        session_id=session, conversation_id=conversation, kind=kind, slot=slot
    )
    return name, timestamp, json.dumps(properties), conversation


def summary(timestamp, number, session=None):
    timestamp = timestamp.replace("Z", ".000Z")
    payload = {
        **SESSION_SUMMARY,
        "timestamp": timestamp,
        "event_id": str(UUID(int=number + 1000, version=4)),
        "session_id": session or str(UUID(int=number + 2000, version=4)),
    }
    return "session_summary", timestamp, json.dumps(payload), str(UUID(int=number))


def test_saved_queries_match_fake_across_local_day_edges(
    event_store, features, monkeypatch
):
    client, events, _, _ = event_store
    register_features(client, 1, features, "UTC")
    events.extend(
        [
            action("2026-11-25T18:29:59Z", conversation="before"),
            action("2026-11-25T18:30:00Z"),
            action("2026-11-26T00:00:00Z"),
            action("2026-11-26T01:00:00Z", "expanded", conversation="only-happened"),
            action("2026-11-27T00:00:00Z", session=SKIP, conversation="excluded"),
            action("2026-11-27T18:29:59Z", conversation="last"),
            action("2026-11-27T18:30:00Z", conversation="after"),
            action(
                "2026-11-27T01:00:00Z", "expanded", kind="writing", slot="reasoning"
            ),
        ]
    )
    summaries = [
        summary("2026-11-25T18:29:59Z", 1),
        summary("2026-11-25T18:30:00Z", 2),
        summary("2026-11-27T00:00:00Z", 3, SKIP),
        summary("2026-11-27T18:29:59Z", 4),
        summary("2026-11-27T18:30:00Z", 5),
    ]
    events.extend(summaries)
    counts = [
        (
            DailyCount(
                START - timedelta(days=1), "coding", 0, 1, frozenset({"before"})
            ),
            "s1",
        ),
        (DailyCount(START, "coding", 0, 2, frozenset({"c1"})), "s1"),
        (DailyCount(END, "coding", 0, 1, frozenset({"excluded"})), SKIP),
        (DailyCount(END, "coding", 0, 1, frozenset({"last"})), "s1"),
        (
            DailyCount(END + timedelta(days=1), "coding", 0, 1, frozenset({"after"})),
            "s1",
        ),
    ]
    fake = FakeEventSource(
        {
            "seen": counts,
            "expanded": [
                *counts,
                (DailyCount(START, "coding", 1, 0, frozenset()), "s1"),
            ],
        },
        [decode_contract(row[2]) for row in summaries],
        ZONE,
    )
    monkeypatch.setenv("TZ", ZONE)
    source = create_event_source(client, 1, features)
    for feature in ("expanded", "seen"):
        assert source.daily_counts(feature, START, END, [SKIP]) == fake.daily_counts(
            feature, START, END, [SKIP]
        )
    assert source.session_summaries(START, END, [SKIP]) == fake.session_summaries(
        START, END, [SKIP]
    )


def test_reads_nonempty_session_summary(event_store, tmp_path):
    client, events, _, _ = event_store
    register_features(client, 1, tmp_path)
    row = summary("2026-11-26T01:00:00Z", 1)
    name, timestamp, properties, event_id = row
    wire_properties = {**json.loads(properties), "$lib": "web", "distinct_id": "person"}
    events.append((name, timestamp, json.dumps(wire_properties), event_id))
    source = create_event_source(client, 1, tmp_path, "UTC")
    assert source.session_summaries(START, END) == [decode_contract(row[2])]


@pytest.mark.parametrize("event_store", ["full_variable_page"], indirect=True)
def test_registration_reuses_bindings_on_later_page(event_store, tmp_path):
    client, _, _, _ = event_store
    assert register_features(client, 1, tmp_path) == (1, 0)
    assert register_features(client, 1, tmp_path) == (0, 1)


@pytest.mark.parametrize("event_store", ["full_variable_page"], indirect=True)
def test_source_reads_with_bindings_on_later_page(event_store, tmp_path):
    client, events, _, _ = event_store
    register_features(client, 1, tmp_path)
    row = summary("2026-11-26T01:00:00Z", 1)
    events.append(row)

    source = create_event_source(client, 1, tmp_path, "UTC")

    assert source.session_summaries(START, END) == [decode_contract(row[2])]


def test_feature_selectors_do_not_create_empty_groups(event_store, features):
    client, events, _, _ = event_store
    register_features(client, 1, features)
    events.append(action("2026-11-26T01:00:00Z", slot="reasoning"))
    source = create_event_source(client, 1, features, "UTC")
    assert source.daily_counts("expanded", START, END) == []


@pytest.mark.parametrize("method", ["daily_counts", "session_summaries"])
def test_reads_every_page_in_order(event_store, features, method):
    client, events, runs, _ = event_store
    register_features(client, 1, features)
    days = [START + timedelta(days=index) for index in range(60)]
    summaries = []
    for index, day in enumerate(days):
        timestamp = f"{day}T01:00:00Z"
        events.extend(action(timestamp, kind=kind) for kind in ("writing", "coding"))
        summaries.extend(
            summary(timestamp, number) for number in (2 * index + 2, 2 * index + 1)
        )
    events.extend(summaries)
    source = create_event_source(client, 1, features, "UTC")
    if method == "daily_counts":
        actual = source.daily_counts("seen", days[0], days[-1])
        expected = [
            DailyCount(day, kind, 0, 1, frozenset({"c1"}))
            for day in days
            for kind in ("coding", "writing")
        ]
    else:
        actual = source.session_summaries(days[0], days[-1])
        expected = [
            decode_contract(row[2])
            for row in sorted(summaries, key=lambda row: (row[1], row[3]))
        ]
    assert actual == expected
    assert [body.get("offset", 0) for _, body in runs] == [0, 100]


@pytest.mark.parametrize("status", [200, 503])
def test_truncated_read_is_unavailable(event_store, features, status):
    client, _, _, failures = event_store
    register_features(client, 1, features)
    source = create_event_source(client, 1, features)
    failures["/api/environments/1/endpoints/seen/run/"] = (
        status,
        {"detail": "cut"},
        True,
    )
    with pytest.raises(EventSourceUnavailable):
        source.daily_counts("seen", START, END)


@pytest.mark.parametrize("status", [403, 404])
def test_runtime_http_error_preserves_response(event_store, features, status):
    client, _, _, failures = event_store
    register_features(client, 1, features)
    source = create_event_source(client, 1, features)
    failures["/api/environments/1/endpoints/seen/run/"] = (
        status,
        {"detail": "bad key"},
    )
    with pytest.raises(RuntimeError, match=f'HTTP {status}.*"bad key"') as caught:
        source.daily_counts("seen", START, END)
    assert type(caught.value) is RuntimeError


def test_missing_project_preserves_response(event_store, tmp_path):
    client, _, _, failures = event_store
    failures["/api/environments/1/insight_variables/"] = (
        404,
        {"detail": "unknown project"},
    )
    with pytest.raises(RuntimeError, match='HTTP 404.*"unknown project"') as caught:
        create_event_source(client, 1, tmp_path)
    assert type(caught.value) is RuntimeError


@pytest.mark.parametrize("failure", [TimeoutError, ConnectionRefusedError])
def test_transport_failure_is_unavailable(event_store, features, monkeypatch, failure):
    client, _, _, _ = event_store
    register_features(client, 1, features)
    source = create_event_source(client, 1, features)

    def fail(*args, **kwargs):
        raise failure("transport failed")

    monkeypatch.setattr("urllib.request.urlopen", fail)
    with pytest.raises(EventSourceUnavailable, match="transport failed"):
        source.daily_counts("seen", START, END)


def test_server_failure_is_unavailable(event_store, features):
    client, _, _, failures = event_store
    register_features(client, 1, features)
    source = create_event_source(client, 1, features)
    failures["/api/environments/1/endpoints/seen/run/"] = (
        503,
        {"detail": "temporarily unavailable"},
    )
    with pytest.raises(EventSourceUnavailable, match="HTTP 503"):
        source.daily_counts("seen", START, END)


@pytest.mark.parametrize("profile", ["development", "production"])
def test_api_container_receives_configured_zone(profile):
    compose = yaml.safe_load((Path(__file__).parents[2] / "compose.yaml").read_text())
    assert compose["services"][f"api-{profile}"]["environment"]["TZ"] == "${TZ:-UTC}"
