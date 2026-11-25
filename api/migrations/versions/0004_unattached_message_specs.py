"""Allow Render to persist message specs before the app saves the message."""

import sqlalchemy as sa
from alembic import op

revision = "0004_unattached_message_specs"
down_revision = "0003_agent_session_instructions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("message_specs") as batch:
        batch.alter_column("session_id", existing_type=sa.String(), nullable=True)
        batch.add_column(
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.current_timestamp(),
            )
        )


def downgrade() -> None:
    connection = op.get_bind()
    unattached = connection.execute(
        sa.text("SELECT count(*) FROM message_specs WHERE session_id IS NULL")
    ).scalar_one()
    if unattached:
        raise RuntimeError("Cannot downgrade while unattached message specs exist")
    with op.batch_alter_table("message_specs") as batch:
        batch.drop_column("created_at")
        batch.alter_column("session_id", existing_type=sa.String(), nullable=False)
