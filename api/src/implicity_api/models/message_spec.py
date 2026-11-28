from datetime import datetime, timezone

from sqlalchemy import JSON, Column, DateTime, MetaData, String, Table

app_metadata = MetaData()

message_specs = Table(
    "message_specs",
    app_metadata,
    Column("id", String, primary_key=True),
    Column("session_id", String),
    Column("data", JSON, nullable=False),
    Column(
        "created_at",
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    ),
)
