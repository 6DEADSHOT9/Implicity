from sqlalchemy import JSON, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class OwnedRow:
    id: Mapped[str] = mapped_column(String, primary_key=True)
    session_id: Mapped[str | None] = mapped_column(String, nullable=True)
    data: Mapped[dict] = mapped_column(JSON, default=dict)


class AgentSession(OwnedRow, Base):
    __tablename__ = "agent_sessions"


class QuotaLog(OwnedRow, Base):
    __tablename__ = "quota_log"
