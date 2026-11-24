"""Create the tables owned by each backend module."""

import sqlalchemy as sa
from alembic import op

revision = "0001_module_tables"
down_revision = None
branch_labels = None
depends_on = None

TABLES_BY_OWNER = {
    "engine": (
        "decisions",
        "explicit_settings",
        "locks",
        "excluded_sessions",
        "layout_revisions",
    ),
    "memory": (
        "memory_items",
        "projects",
        "drafts",
        "inferences",
        "typing_profiles",
        "guest_patterns",
    ),
    "app": (
        "conversations",
        "messages",
        "message_specs",
        "kinds",
        "looks",
        "widgets",
        "schedules",
        "workflows",
        "files",
    ),
    "agent": ("agent_sessions", "quota_log"),
}
SESSION_REQUIRED = {"messages", "message_specs", "agent_sessions"}


def upgrade() -> None:
    for tables in TABLES_BY_OWNER.values():
        for table in tables:
            op.create_table(
                table,
                sa.Column("id", sa.String(), primary_key=True),
                sa.Column(
                    "session_id", sa.String(), nullable=table not in SESSION_REQUIRED
                ),
                sa.Column("data", sa.JSON(), nullable=False),
            )


def downgrade() -> None:
    for tables in reversed(tuple(TABLES_BY_OWNER.values())):
        for table in reversed(tables):
            op.drop_table(table)
