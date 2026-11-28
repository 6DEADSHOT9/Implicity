"""Separate message conversation identity from its browser session."""

import sqlalchemy as sa
from alembic import op

revision = "0005_message_conversation_id"
down_revision = "0004_unattached_message_specs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("conversation_id", sa.String(), nullable=True))
    op.execute("UPDATE messages SET conversation_id = session_id")
    with op.batch_alter_table("messages") as batch:
        batch.alter_column("conversation_id", existing_type=sa.String(), nullable=False)
        batch.create_index("ix_messages_conversation_id", ["conversation_id"])


def downgrade() -> None:
    with op.batch_alter_table("messages") as batch:
        batch.drop_index("ix_messages_conversation_id")
        batch.drop_column("conversation_id")
