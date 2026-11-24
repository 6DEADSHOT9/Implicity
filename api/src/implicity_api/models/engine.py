from sqlalchemy import JSON, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class OwnedRow:
    id: Mapped[str] = mapped_column(String, primary_key=True)
    session_id: Mapped[str | None] = mapped_column(String, nullable=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)


class Decision(OwnedRow, Base):
    __tablename__ = "decisions"


class ExplicitSetting(OwnedRow, Base):
    __tablename__ = "explicit_settings"


class Lock(OwnedRow, Base):
    __tablename__ = "locks"


class ExcludedSession(OwnedRow, Base):
    __tablename__ = "excluded_sessions"


class LayoutRevision(OwnedRow, Base):
    __tablename__ = "layout_revisions"
