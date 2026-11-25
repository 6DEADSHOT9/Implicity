"""Add the agent module's quota settings table."""

import sqlalchemy as sa
from alembic import op

revision = "0002_agent_quota_settings"
down_revision = "0001_module_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "quota_settings",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("session_id", sa.String(), nullable=True),
        sa.Column("data", sa.JSON(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("quota_settings")
