from sqlalchemy import JSON, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class OwnedRow:
    id: Mapped[str] = mapped_column(String, primary_key=True)
    session_id: Mapped[str | None] = mapped_column(String, nullable=True)
    data: Mapped[dict] = mapped_column(JSON)


class MemoryItem(OwnedRow, Base):
    __tablename__ = "memory_items"


class Project(OwnedRow, Base):
    __tablename__ = "projects"


class Draft(OwnedRow, Base):
    __tablename__ = "drafts"


class Inference(OwnedRow, Base):
    __tablename__ = "inferences"


class TypingProfile(OwnedRow, Base):
    __tablename__ = "typing_profiles"


class GuestPattern(OwnedRow, Base):
    __tablename__ = "guest_patterns"
