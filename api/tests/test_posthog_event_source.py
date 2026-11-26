import json
import threading
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from implicity_api.modules.event_source.posthog import PostHog, PostHogEventSource
from implicity_engine import (
    DailyCount,
    EventSourceUnavailable,
    FakeEventSource,
    Feature,
)

FEATURES = Path(__file__).parents[2] / "contracts" / "features"


def test_event_source_matches_fake_and_passes_window_and_exclusions(tmp_path):
    requests = []
    rows = [
        ["2026-11-26", "work", ["c1", "c2"], 1, 2],
        ["2026-11-27", "work", ["c3"], 0, 1],
    ]

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            body = json.dumps(
                {
                    "results": [
                        {
                            "name": f"{name} {part}",
                            "code_name": f"v_{part}",
                            "type": "String",
                        }
                        for name in (
                            "long_answer_expanded",
                            "long_answer_seen",
                            "session_summaries",
                        )
                        for part in ("start", "end", "excluded_sessions")
                    ]
                }
            ).encode()
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_POST(self):
            size = int(self.headers["Content-Length"])
            body = json.loads(self.rfile.read(size))
            requests.append((self.path, body))
            payload = {
                "results": rows,
                "columns": [
                    "day",
                    "kind",
                    "conversation_ids",
                    "happened",
                    "could_have",
                ],
            }
            encoded = json.dumps(payload).encode()
            self.send_response(200)
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

        def log_message(self, *_):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        client = PostHog(f"http://127.0.0.1:{server.server_port}", "local-test-key")
        (tmp_path / "long_answer_expanded.yaml").write_text(
            "id: long_answer_expanded\nhappened: {event: expanded}\n"
            "could_have: {event: seen}\ngroup_by: [day, kind]\n"
        )
        (tmp_path / "long_answer_seen.yaml").write_text(
            "id: long_answer_seen\ncould_have: {event: seen}\ngroup_by: [day, kind]\n"
        )
        source = PostHogEventSource(client, 1, tmp_path, "Asia/Kolkata")
        actual = source.daily_counts(
            "long_answer_expanded", date(2026, 11, 26), date(2026, 11, 27), ["excluded"]
        )
        expected = FakeEventSource(
            {
                "long_answer_expanded": [
                    (
                        DailyCount(date(2026, 11, 26), "work", 1, 2, frozenset({"c1"})),
                        "s1",
                    ),
                    (
                        DailyCount(date(2026, 11, 26), "work", 0, 0, frozenset({"c2"})),
                        "s2",
                    ),
                    (
                        DailyCount(date(2026, 11, 27), "work", 0, 1, frozenset({"c3"})),
                        "s1",
                    ),
                ]
            },
            [],
            "Asia/Kolkata",
            {
                "long_answer_expanded": Feature(
                    "long_answer_expanded",
                    {"event": "expanded"},
                    {"event": "seen"},
                    ("day", "kind"),
                )
            },
        ).daily_counts(
            "long_answer_expanded", date(2026, 11, 26), date(2026, 11, 27), ["excluded"]
        )
        assert actual == expected
        assert requests[0] == (
            "/api/environments/1/endpoints/long_answer_expanded/run/",
            {
                "variables": {
                    "v_start": "2026-11-26",
                    "v_end": "2026-11-27",
                    "v_excluded_sessions": "excluded",
                }
            },
        )
        assert source.features["long_answer_seen"].happened is None
    finally:
        server.shutdown()
        worker.join()
        server.server_close()


def test_connection_and_server_failures_are_event_source_unavailable():
    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            self.send_error(503, "temporarily unavailable")

        def log_message(self, *_):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        client = PostHog(f"http://127.0.0.1:{server.server_port}", "key")
        try:
            client.run_endpoint(1, "feature", {})
        except EventSourceUnavailable:
            pass
        else:
            raise AssertionError("5xx did not pause event-source reads")
    finally:
        server.shutdown()
        worker.join()
        server.server_close()
