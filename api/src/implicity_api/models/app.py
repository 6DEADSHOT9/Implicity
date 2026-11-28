from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class OwnedRow:
    id: Mapped[str] = mapped_column(String, primary_key=True)
    session_id: Mapped[str | None] = mapped_column(String, nullable=True)
    data: Mapped[dict] = mapped_column(JSON)


class Conversation(OwnedRow, Base):
    __tablename__ = "conversations"


class Message(OwnedRow, Base):
    __tablename__ = "messages"
    session_id: Mapped[str] = mapped_column(String, nullable=False)
    conversation_id: Mapped[str] = mapped_column(String, nullable=False, index=True)


class MessageSpec(OwnedRow, Base):
    __tablename__ = "message_specs"
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class Kind(OwnedRow, Base):
    __tablename__ = "kinds"


class Look(OwnedRow, Base):
    __tablename__ = "looks"


class Widget(OwnedRow, Base):
    __tablename__ = "widgets"


class Schedule(OwnedRow, Base):
    __tablename__ = "schedules"


class Workflow(OwnedRow, Base):
    __tablename__ = "workflows"


class File(OwnedRow, Base):
    __tablename__ = "files"
