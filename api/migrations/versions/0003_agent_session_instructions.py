"""Persist the agent prompt context with its session."""

import sqlalchemy as sa
from alembic import op

revision = "0003_agent_session_instructions"
down_revision = "0002_agent_quota_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agent_sessions", sa.Column("instructions", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("agent_sessions", "instructions")
