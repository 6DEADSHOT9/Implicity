"""Create the tables owned by each backend module."""

import sqlalchemy as sa
from alembic import op

revision = "0001_module_tables"
down_revision = None
branch_labels = None
depends_on = None

TABLES = (
    "decisions",
    "explicit_settings",
    "locks",
    "excluded_sessions",
    "layout_revisions",
    "memory_items",
    "projects",
    "drafts",
    "inferences",
    "typing_profiles",
    "guest_patterns",
    "conversations",
    "messages",
    "message_specs",
    "kinds",
    "looks",
    "widgets",
    "schedules",
    "workflows",
    "files",
    "agent_sessions",
    "quota_log",
)


def upgrade() -> None:
    for table in TABLES:
        op.create_table(
            table,
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("session_id", sa.String(), nullable=True),
            sa.Column("data", sa.JSON(), nullable=False),
        )


def downgrade() -> None:
    for table in reversed(TABLES):
        op.drop_table(table)
