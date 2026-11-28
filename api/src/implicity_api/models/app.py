from sqlalchemy import JSON, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from implicity_api.models.message_spec import app_metadata, message_specs


class Base(DeclarativeBase):
    metadata = app_metadata


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


class MessageSpec(Base):
    __table__ = message_specs
    __tablename__ = message_specs.name


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
